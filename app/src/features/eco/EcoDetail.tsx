import { FileUpload } from '@/components/data-io/FileUpload'
import { Lifecycle } from '@/components/lifecycle/Lifecycle'
import { WhereThisStandsBand } from '@/components/lifecycle/WhereThisStandsBand'
import { SupplierShare } from '@/components/pickers/SupplierShare'
import { Card } from '@/components/primitives/Card'
import { Chip, phaseChip, stageChip } from '@/components/primitives/Chip'
import { Empty } from '@/components/primitives/Empty'
import { Field, Input, Select } from '@/components/primitives/Field'
import { Modal } from '@/components/primitives/Modal'
import { SpecList } from '@/components/primitives/SpecList'
import { Tabs } from '@/components/primitives/Tabs'
import { BOM_1003140 } from '@/domain/boms'
import { deriveAffectedAssemblies, deriveInventoryDisposition } from '@/domain/ecoDerivations'
import { ECO_010870_ITEMS, LC, ecoById, historyFor } from '@/domain/ecos'
import { useAllBomItems } from '@/data/bomItems'
import { ROUTINGS, deriveApprovalState, notificationRecipientsFor } from '@/domain/routings'
import { ME } from '@/domain/session'
import { suppliersFor } from '@/domain/suppliers'
import { useAllChangeOrders, useUpdateChangeOrder, type CoHistoryEntry, type ApprovalEntry, type AffectedAssemblyEntry, type InventoryDispositionEntry } from '@/data/changeOrders'
import { useEcoComments, usePostEcoComment, type EcoCommentRecord } from '@/data/ecoComments'

import { useUsers } from '@/data/admin'
import { useExportEcoExcel } from '@/data/export'
import { useSendReminder } from '@/data/reminder'
import { downloadFile } from '@/lib/download'
import { toast } from 'sonner'
import { initials } from '@/lib/prng'
import { T } from '@/theme/tokens'
import { AlertCircle, AlertTriangle, Ban, Bell, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, Clock, CornerUpLeft, Database, Download, FileText, Info, Layers, Link2, Loader2, MessageSquare, Plus, RefreshCw, Send, Sparkles, Trash2, Users, X } from 'lucide-react'
import { format } from 'date-fns'
import React, { useState } from 'react'

function EcoDetail({ id, go, initialTab, renderHeaderActions, role = 'unknown', currentUserName = '' }: { id: any; go: any; initialTab?: string; renderHeaderActions?: () => React.ReactNode; role?: string; currentUserName?: string }) {
  const isApproverRole = role === 'approver'
  const { sendReminder } = useSendReminder()
  // Try static domain first; then overlay with backend data for backend-created COs
  const { data: allBackendOrders } = useAllChangeOrders();
  const backendCo = allBackendOrders.find((o) => o.coId === id);
  const staticEco = ecoById(id);
  // Build a merged ECO object — backend fields win where present
  const eco = backendCo
    ? {
        ...staticEco,
        id: backendCo.coId,
        title: backendCo.title,
        cat: backendCo.cat,
        stage: backendCo.stage,
        div: backendCo.div,
        site: backendCo.site,
        routing: backendCo.routing,
        creator: backendCo.creator,
        submitter: backendCo.submitter,
        dc: backendCo.dc,
        created: backendCo.created,
        submitted: backendCo.submitted,
        items: backendCo.itemCount,
        mods: backendCo.modCount,
        pns: (() => { try { return JSON.parse(backendCo.pnsJson); } catch { return []; } })(),
        desc: backendCo.desc,
        redline: backendCo.redline,
        notes: backendCo.notes,
        ecoItems: backendCo.ecoItems ?? [],
        comments: backendCo.comments ?? [],
        rejectionReason: backendCo.rejectionReason ?? '',
        rejectionNotes: backendCo.rejectionNotes ?? '',
        rejectedBy: backendCo.rejectedBy ?? '',
        history: backendCo.history ?? [],
        extraNotifyNames: backendCo.extraNotifyNames ?? [],
        affectedAssemblies: backendCo.affectedAssemblies ?? [],
        inventoryDisposition: backendCo.inventoryDisposition ?? [],
        // Always null-out the static affectedAssembly so the BOM Redline tab
        // reads only from ecoItems (the real data saved at creation time).
        affectedAssembly: null,
      }
    : { ...staticEco, ecoItems: [] as any[], comments: [] as any[], rejectionReason: '', rejectionNotes: '', rejectedBy: '', history: [] as CoHistoryEntry[], extraNotifyNames: [] as string[] };
  // Use real persisted approvals from backend when available; fall back to derived for static ECOs.
  // Normalise backend ApprovalEntry shape to the legacy {g, n, req, st, at, cm, others} shape
  // that the Approvals tab rendering already uses — keeping one render path.
  const backendApprovals = backendCo?.approvals ?? []
  const approvalState = backendApprovals.length > 0
    ? (() => {
        const roles = backendApprovals.map((a) => ({
          g: a.role,
          n: a.approver,
          req: a.req,
          stage: a.stage,
          st: a.status,
          at: a.signedAt,
          cm: a.comment,
          others: a.others ?? [],
        }))
        const required = roles.filter((r) => r.req !== 'Comments only')
        const decided = required.filter((r) => r.st !== 'pending')
        const open = required.filter((r) => r.st === 'pending')
        const commentsOnly = roles.filter((r) => r.req === 'Comments only')
        return { roles, required, decided, open, commentsOnly, totalCount: roles.length, requiredCount: required.length, decidedCount: decided.length, openCount: open.length }
      })()
    : deriveApprovalState(eco)
  const APPROVALS = approvalState.roles;
  const HISTORY = historyFor(eco);
  const rejected = eco.stage === "Rejected";
  // Withdrawn-for-rework: stage is Open but rejection context still present
  const withdrawnForRework = eco.stage === "Submit" && !!eco.rejectedBy;
  const TABS = ["Summary", "Items", "Files", "Approvals", "Supplier Access", "Notifications", "History"];
  const [tab, setTab] = useState(
    initialTab && TABS.includes(initialTab)
      ? initialTab
      : "Summary"
  );

  const [modal, setModal] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [aiReview, setAiReview] = useState(false);
  const [actions, setActions] = useState(false);
  const [shared, setShared] = useState<any[]>([]);
  const [shareDraft, setShareDraft] = useState<any[]>([]);


  const [itemSub, setItemSub] = useState("Modifications");
  const [activeRedlineItem, setActiveRedlineItem] = useState<any>(null);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemQ, setAddItemQ] = useState('');
  const [addItemQty, setAddItemQty] = useState('1 EA');

  // Unique BOM parts from the backend — source for the Add Item picker
  const { bomItems: allBomItemsRaw, loading: bomItemsLoading } = useAllBomItems()
  const uniqueBomParts = (() => {
    const seen = new Set<string>()
    const out: typeof allBomItemsRaw = []
    for (const item of allBomItemsRaw) {
      if (!seen.has(item.pn)) { seen.add(item.pn); out.push(item) }
    }
    return out
  })()
  const [modPage, setModPage] = useState(1);
  const [selectedPns, setSelectedPns] = useState<any[]>([]);

  /* ---- ECO Excel export ---- */
  const { runExport: runEcoExcelExport, isPending: isExporting } = useExportEcoExcel()

  const handleExportExcel = async () => {
    setActions(false)
    try {
      toast.loading('Generating Excel…', { id: 'eco-export' })
      await runEcoExcelExport(eco.id)
      toast.dismiss('eco-export')
      toast.success('Excel downloaded.')
    } catch (err) {
      toast.dismiss('eco-export')
      toast.error('Export failed — please try again.')
    }
  }

  /* ---- Approve / Reject for Approver role ---- */
  const updateChangeOrder = useUpdateChangeOrder()

  /** Add a BOM kit item to the active redline kit and write back to the backend. */
  const handleAddBomItem = async (item: any, qty: string) => {
    if (!backendCo) return
    const kitPn = activeRedlineItem?.pn ?? eco.ecoItems?.[0]?.pn
    const updatedItems = eco.ecoItems.map((ki: any) => {
      if (ki.pn !== kitPn) return ki
      const already = ki.bomEdits.some((e: any) => e.pn === item.pn && e.type === 'ADD')
      if (already) return ki
      return {
        ...ki,
        bomEdits: [
          ...ki.bomEdits,
          { id: `add-${item.pn}-${Date.now()}`, type: 'ADD', pn: item.pn, name: item.name, qty, newValue: '' },
        ],
      }
    })
    try {
      await updateChangeOrder(backendCo.id, { ecoItems: updatedItems } as any, backendCo)
      toast.success(`${item.pn} added to BOM redline`)
    } catch {
      toast.error('Failed to add item')
    }
    setAddItemOpen(false)
    setAddItemQ('')
    setAddItemQty('1 EA')
  }

  /** Remove a BOM edit row from the active redline kit and write back to the backend. */
  const handleDeleteBomEdit = async (editId: string) => {
    if (!backendCo) return
    const kitPn = activeRedlineItem?.pn ?? eco.ecoItems?.[0]?.pn
    const updatedItems = eco.ecoItems.map((ki: any) => {
      if (ki.pn !== kitPn) return ki
      return { ...ki, bomEdits: ki.bomEdits.filter((e: any) => e.id !== editId) }
    })
    try {
      await updateChangeOrder(backendCo.id, { ecoItems: updatedItems } as any, backendCo)
      toast.success('Item removed from BOM redline')
    } catch {
      toast.error('Failed to remove item')
    }
  }

  /**
   * Find the display name that actually appears in the approval entries for this user.
   * The platform auth returns a username ("admin") which may differ from the display name
   * stored in the approval list ("Hannerose Santiago"). We try currentUserName first,
   * then ME.name, then fall back to currentUserName for the history entry author field.
   */
  const resolveApproverName = (approvals: ApprovalEntry[]): { approverName: string; matchedEntry: ApprovalEntry | undefined } => {
    const candidates = [currentUserName, ME.name].filter(Boolean)
    for (const name of candidates) {
      const match = approvals.find((a) => a.approver === name || (a.others ?? []).includes(name))
      if (match) return { approverName: name, matchedEntry: match }
    }
    // No match in approval list — use ME.name as identity for the history record author
    return { approverName: ME.name || currentUserName, matchedEntry: undefined }
  }
  const [approvalDone, setApprovalDone] = useState<'approved' | 'rejected' | null>(null)
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectNotes, setRejectNotes] = useState('')
  const [isRejecting, setIsRejecting] = useState(false)
  // DC reject modal state (modal === "reject")
  const [dcRejectReason, setDcRejectReason] = useState('')
  const [dcRejectNotes, setDcRejectNotes] = useState('')
  const [isDcRejecting, setIsDcRejecting] = useState(false)
  // DC approve modal state
  const [dcApproveComment, setDcApproveComment] = useState('')
  const [isDcApproving, setIsDcApproving] = useState(false)
  // Complete + Withdraw modal state
  const [isCompleting, setIsCompleting] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  const handleDcReject = async () => {
    if (!dcRejectReason.trim()) return
    setIsDcRejecting(true)
    try {
      if (backendCo) {
        const { approverName: rejecterName } = resolveApproverName(backendCo.approvals)
        // Mark only the rejecter's own entry as rejected; all others stay as-is
        const updatedApprovals = backendCo.approvals.map((a) => {
          const isThisUser = a.approver === rejecterName || (a.others ?? []).includes(rejecterName)
          if (isThisUser) {
            return { ...a, status: 'rejected' as const, signedAt: new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' }), comment: dcRejectReason.trim() }
          }
          return a
        })
        const newHistoryEntry: CoHistoryEntry = {
          id: `h-${Date.now()}`,
          timestamp: new Date().toISOString(),
          who: rejecterName,
          action: `Rejected — ${dcRejectReason.trim()}${dcRejectNotes.trim() ? `: "${dcRejectNotes.trim()}"` : ''}`,
        }
        await updateChangeOrder(backendCo.id, {
          stage: 'Rejected',
          approvals: updatedApprovals,
          rejectionReason: dcRejectReason.trim(),
          rejectionNotes: dcRejectNotes.trim(),
          rejectedBy: rejecterName,
          history: [...(backendCo.history ?? []), newHistoryEntry],
        }, backendCo)
      }
      setModal(null)
      setDcRejectReason('')
      setDcRejectNotes('')
      toast.success('Change order rejected.')
    } catch {
      toast.error('Failed to reject — please try again.')
    } finally {
      setIsDcRejecting(false)
    }
  }

  // DC Approve: mark ONLY the entry whose approver/others matches the current user.
  // Every other entry is preserved exactly as stored — no other row is touched.
  const handleDcApprove = async () => {
    if (!backendCo) { setModal(null); return }
    setIsDcApproving(true)
    try {
      const { approverName, matchedEntry: matchedRole } = resolveApproverName(backendCo.approvals)
      const now = new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      // Touch only the matched entry; all others stay untouched
      const updatedApprovals = backendCo.approvals.map((a) => {
        const isThisUser = a.approver === approverName || (a.others ?? []).includes(approverName)
        if (isThisUser && a.status === 'pending') {
          return { ...a, status: 'approved' as const, signedAt: now, comment: dcApproveComment.trim() }
        }
        return a
      })
      // Advance to Effective only when ALL required roles (every stage) have decided
      const allDone = updatedApprovals
        .filter((a) => a.req !== 'Comments only')
        .every((a) => a.status !== 'pending')
      const newStage = allDone ? 'Effective' : 'Approval'
      const newEntry: CoHistoryEntry = {
        id: `h-${Date.now()}`,
        timestamp: new Date().toISOString(),
        who: approverName,
        action: `Approved \u2014 Stage ${matchedRole?.stage ?? backendCo.currentStageNum ?? 1}, ${matchedRole?.role ?? 'Document Control'}${dcApproveComment.trim() ? `: "${dcApproveComment.trim()}"` : ''}${allDone ? ' \u2014 all stages complete, advanced to Effective' : ''}`,
      }
      await updateChangeOrder(backendCo.id, {
        stage: newStage,
        effectiveDate: allDone ? new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : backendCo.effectiveDate,
        approvals: updatedApprovals,
        history: [...(backendCo.history ?? []), newEntry],
      }, backendCo)
      setModal(null)
      setDcApproveComment('')
      toast.success(allDone ? 'Change order advanced to Effective.' : 'Approval recorded.')
    } catch {
      toast.error('Failed to record approval \u2014 please try again.')
    } finally {
      setIsDcApproving(false)
    }
  }

  // Complete: move from Effective → Complete with SAP sign-off history entry
  const handleComplete = async () => {
    if (!backendCo) { setModal(null); return }
    setIsCompleting(true)
    try {
      const { approverName } = resolveApproverName(backendCo.approvals)
      const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
      const newEntry: CoHistoryEntry = {
        id: `h-${Date.now()}`,
        timestamp: new Date().toISOString(),
        who: approverName,
        action: `Marked Complete \u2014 SAP write-back verified, all BOM fields matched`,
      }
      await updateChangeOrder(backendCo.id, {
        stage: 'Complete',
        completedDate: today,
        history: [...(backendCo.history ?? []), newEntry],
      }, backendCo)
      setModal(null)
      toast.success('Change order marked Complete.')
    } catch {
      toast.error('Failed to complete \u2014 please try again.')
    } finally {
      setIsCompleting(false)
    }
  }

  // Withdraw: move back to Open, clear approvals to pending, add history entry
  const handleWithdraw = async () => {
    if (!backendCo) { setModal(null); return }
    setIsWithdrawing(true)
    try {
      const { approverName } = resolveApproverName(backendCo.approvals)
      const resetApprovals = backendCo.approvals.map((a) => ({
        ...a, status: 'pending' as const, signedAt: '', comment: '',
      }))
      const newEntry: CoHistoryEntry = {
        id: `h-${Date.now()}`,
        timestamp: new Date().toISOString(),
        who: approverName,
        action: `Withdrawn for rework \u2014 returned to Submit stage, all prior decisions cleared`,
      }
      await updateChangeOrder(backendCo.id, {
        stage: 'Submit',
        approvals: resetApprovals,
        history: [...(backendCo.history ?? []), newEntry],
      }, backendCo)
      setModal(null)
      toast.success('Change order withdrawn for rework.')
    } catch {
      toast.error('Failed to withdraw \u2014 please try again.')
    } finally {
      setIsWithdrawing(false)
    }
  }

  // Submit to routing: move back from Open → Approval, reset approvals, add history
  const [isSubmitting, setIsSubmitting] = useState(false)
  const handleSubmitToRouting = async () => {
    if (!backendCo) { toast.error('Change order not loaded'); return }
    setIsSubmitting(true)
    try {
      const resetApprovals = backendCo.approvals.map((a) => ({
        ...a, status: 'pending' as const, signedAt: '', comment: '',
      }))
      const newEntry: CoHistoryEntry = {
        id: `h-${Date.now()}`,
        timestamp: new Date().toISOString(),
        who: ME.name,
        action: 'Resubmitted to routing — returned to Approval after rework',
      }
      await updateChangeOrder(backendCo.id, {
        stage: 'Approval',
        approvals: resetApprovals,
        rejectionReason: '',
        rejectionNotes: '',
        rejectedBy: '',
        history: [...(backendCo.history ?? []), newEntry],
      }, backendCo)
      toast.success('Change order resubmitted to approval routing.')
    } catch {
      toast.error('Failed to submit — please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const canApprove = isApproverRole && eco.stage === 'Approval' && (eco.awaitingMe === true || eco.mine === true)

  // Check whether the current user has already signed off on any approval entry.
  // Covers both the approver role and the DC role — once signed, buttons disappear.
  const currentUserNames = [currentUserName, ME.name].filter(Boolean)
  const hasCurrentUserApproved = backendApprovals.some(
    (a) => a.status !== 'pending' && currentUserNames.some(
      (n) => a.approver === n || (a.others ?? []).includes(n)
    )
  )
  const [isApproving, setIsApproving] = useState(false)
  const handleApprove = async () => {
    if (!backendCo) { setApprovalDone('approved'); return }
    setIsApproving(true)
    try {
      const { approverName, matchedEntry } = resolveApproverName(backendCo.approvals)
      const now = new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      // Mark only the matched entry; all others untouched
      const updatedApprovals = backendCo.approvals.map((a) => {
        const isThisUser = a.approver === approverName || (a.others ?? []).includes(approverName)
        if (isThisUser && a.status === 'pending') {
          return { ...a, status: 'approved' as const, signedAt: now }
        }
        return a
      })
      const newEntry: CoHistoryEntry = {
        id: `h-${Date.now()}`,
        timestamp: new Date().toISOString(),
        who: approverName,
        action: `Approved — Stage ${matchedEntry?.stage ?? backendCo.currentStageNum ?? 1}, ${matchedEntry?.role ?? 'Reviewer'}`,
      }
      await updateChangeOrder(backendCo.id, {
        approvals: updatedApprovals,
        history: [...(backendCo.history ?? []), newEntry],
      }, backendCo)
      setApprovalDone('approved')
    } catch {
      toast.error('Failed to record approval — please try again.')
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return
    setIsRejecting(true)
    try {
      if (backendCo) {
        const { approverName: rejecterName, matchedEntry: matchedRole } = resolveApproverName(backendCo.approvals)
        // Mark only the rejecter's own entry as rejected; all others stay as-is
        const updatedApprovals = backendCo.approvals.map((a) => {
          const isThisUser = a.approver === rejecterName || (a.others ?? []).includes(rejecterName)
          if (isThisUser) {
            return { ...a, status: 'rejected' as const, signedAt: new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' }), comment: rejectReason.trim() }
          }
          return a
        })
        const newHistoryEntry: CoHistoryEntry = {
          id: `h-${Date.now()}`,
          timestamp: new Date().toISOString(),
          who: rejecterName,
          action: `Rejected — Stage ${matchedRole?.stage ?? backendCo.currentStageNum ?? 1}, ${matchedRole?.role ?? 'Reviewer'}: "${rejectReason.trim()}"${rejectNotes.trim() ? ` — ${rejectNotes.trim()}` : ''}`,
        }
        await updateChangeOrder(backendCo.id, {
          stage: 'Rejected',
          approvals: updatedApprovals,
          rejectionReason: rejectReason.trim(),
          rejectionNotes: rejectNotes.trim(),
          rejectedBy: rejecterName,
          history: [...(backendCo.history ?? []), newHistoryEntry],
        }, backendCo)
      }
      setApprovalDone('rejected')
      setRejectModal(false)
      setRejectReason('')
      setRejectNotes('')
    } catch {
      toast.error('Failed to update status — please try again.')
    } finally {
      setIsRejecting(false)
    }
  }

  /* ---- Add notification recipient modal ---- */
  const { users: allUsers } = useUsers()
  const [notifyModalOpen, setNotifyModalOpen] = useState(false)
  const [notifySearch, setNotifySearch] = useState('')
  const [isSavingNotify, setIsSavingNotify] = useState(false)
  const handleAddNotifyUser = async (userName: string) => {
    if (!backendCo) return
    const current: string[] = (eco as any).extraNotifyNames ?? []
    if (current.includes(userName)) { setNotifyModalOpen(false); return }
    const updated = [...current, userName]
    setIsSavingNotify(true)
    try {
      await updateChangeOrder(backendCo.id, { extraNotifyNames: updated } as any, backendCo)
      toast.success(`${userName} added to notifications.`)
      setNotifyModalOpen(false)
      setNotifySearch('')
    } catch {
      toast.error('Failed to add — please try again.')
    } finally {
      setIsSavingNotify(false)
    }
  }

  /* ---- Comment drawer ---- */
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [isSavingComment, setIsSavingComment] = useState(false)

  // The author is always the current logged-in user — never editable
  const commentAuthor = currentUserName || ME.name

  // Backend comment records — each comment is its own record, no blob merging
  const { comments: backendComments, loading: commentsLoading } = useEcoComments(eco.id)
  const postEcoComment = usePostEcoComment()

  // Optimistic count — how many comments we expect after a post, used to clear optimistic copies
  const [optimisticComments, setOptimisticComments] = useState<EcoCommentRecord[]>([])
  const prevBackendCountRef = React.useRef(backendComments.length)
  React.useEffect(() => { setOptimisticComments([]); prevBackendCountRef.current = 0 }, [eco.id])

  // Drop optimistic entries as soon as the backend count grows — the real record arrived
  React.useEffect(() => {
    if (backendComments.length > prevBackendCountRef.current) {
      setOptimisticComments([])
    }
    prevBackendCountRef.current = backendComments.length
  }, [backendComments.length])

  const allComments = React.useMemo(() => {
    // Only show optimistic entries when the backend hasn't caught up yet
    const merged = optimisticComments.length > 0
      ? [...backendComments, ...optimisticComments]
      : backendComments
    return [...merged].sort((a, b) => a.timestamp - b.timestamp)
  }, [backendComments, optimisticComments])

  /** Format epoch ms for display. */
  function formatCommentTime(ts: number): string {
    if (!ts || ts < 1_000_000_000_000) return '—'
    return format(new Date(ts), 'MMM d, yyyy h:mm a')
  }

  const handleSaveComment = async () => {
    if (!commentText.trim()) return
    const epochMs = Date.now()
    const optimistic: EcoCommentRecord = {
      id: `opt-${epochMs}`,
      ecoId: eco.id,
      author: commentAuthor,
      message: commentText.trim(),
      timestamp: epochMs,
    }
    // Show immediately in the drawer — don't close it
    setOptimisticComments((prev) => [...prev, optimistic])
    setCommentText('')
    setIsSavingComment(true)
    try {
      await postEcoComment({ ecoId: eco.id, author: commentAuthor, message: optimistic.message, timestamp: epochMs })
      toast.success('Comment added.')
    } catch {
      // Roll back on failure
      setOptimisticComments((prev) => prev.filter((c) => c.id !== optimistic.id))
      toast.error('Failed to save comment — please try again.')
    } finally {
      setIsSavingComment(false)
    }
  }

  // Reset page when switching ECO or changing view
  React.useEffect(() => {
    setModPage(1);
    setSelectedPns([]);
    setActiveRedlineItem(null);

  }, [id]);

  React.useEffect(() => {
    if (initialTab && TABS.includes(initialTab)) {
      setTab(initialTab);
    }
  }, [initialTab]);

  const redlineTarget = activeRedlineItem || (eco.id === "ECO-010870" ? ECO_010870_ITEMS[0] : null);

  return (
    <div className="stack" data-test-id="eco-detail-page">
      <div>
        <div className="crumb" data-test-id="eco-detail-breadcrumb">
          <a onClick={() => go({ page: "ecos" })} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <ChevronLeft size={12} strokeWidth={2.5} />Changes
          </a>
          <ChevronRight size={11} />{eco.id}
        </div>
        <div className="bet">
          <div className="row" style={{ gap: 10 }}>
            <h1>{eco.id}</h1>
            {stageChip(rejected ? "Rejected" : eco.stage)}
            <span className="sub">{eco.title}</span>
          </div>
          <div className="row">
            {/* Approver-role actions: approve / reject this ECO */}
            {isApproverRole && canApprove && approvalDone === null && !hasCurrentUserApproved && (
              <>
                <button className="btn dan" onClick={() => setRejectModal(true)} data-test-id="approver-reject-btn">
                  <X size={13} />Reject
                </button>
                <button className="btn ok" onClick={handleApprove} disabled={isApproving} data-test-id="approver-approve-btn">
                  {isApproving ? <><Loader2 size={13} className="animate-spin" />Approving…</> : <><Check size={13} />Approve</>}
                </button>
              </>
            )}
            {isApproverRole && (approvalDone === 'approved' || (approvalDone === null && hasCurrentUserApproved)) && (
              <span className="chip c-ok" style={{ fontSize: 13, padding: "6px 12px" }} data-test-id="approver-approved-badge">
                <Check size={13} />Your approval recorded
              </span>
            )}
            {isApproverRole && approvalDone === 'rejected' && (
              <span className="chip c-bad" style={{ fontSize: 13, padding: "6px 12px" }} data-test-id="approver-rejected-badge">
                <X size={13} />Rejection submitted
              </span>
            )}

            {/* DC-only actions */}
            {!isApproverRole && rejected && <button className="btn dan" onClick={() => setModal("withdraw")}><CornerUpLeft size={13} />Withdraw to Open</button>}
            {!isApproverRole && eco.stage === "Approval" && !hasCurrentUserApproved && <>
              <button className="btn" onClick={() => setRejectModal(true)}><X size={13} />Reject</button>
              <button className="btn ok" onClick={() => setModal("approve")}><Check size={13} />Approve</button>
            </>}
            {!isApproverRole && eco.stage === "Approval" && hasCurrentUserApproved && (
              <span className="chip c-ok" style={{ fontSize: 13, padding: "6px 12px" }} data-test-id="dc-approved-badge">
                <Check size={13} />Your approval recorded
              </span>
            )}
            {!isApproverRole && eco.stage === "Submit" && (
              <button className="btn pri" onClick={handleSubmitToRouting} disabled={isSubmitting} data-test-id="submit-to-routing-btn">
                {isSubmitting ? <><Loader2 size={13} className="animate-spin" />Submitting&hellip;</> : <><Send size={13} />Submit to routing</>}
              </button>
            )}
            {!isApproverRole && eco.stage === "Effective" && <button className="btn pri" onClick={() => setModal("complete")}><CheckCircle2 size={13} />Verify SAP and complete</button>}
            {!isApproverRole && (
              <div style={{ position: "relative" }}>
                <button className="btn" onClick={() => setActions(!actions)}>Actions<ChevronDown size={13} /></button>
                {actions && (<>
                  <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setActions(false)} />
                  <div className="menu">
                    <button
                      onClick={handleExportExcel}
                      disabled={isExporting}
                      data-test-id="actions-export-excel-btn"
                    >
                      {isExporting ? <><Loader2 size={14} className="spin" />Generating…</> : <><Download size={14} />Export to Excel</>}
                    </button>
                    <button onClick={() => { setActions(false); setCommentDrawerOpen(true); }}>
                      <FileText size={14} />Add A Comment
                    </button>
                    <button onClick={() => {
                      setActions(false);
                      navigator.clipboard.writeText(window.location.href);
                      toast.success('Link copied to clipboard');
                    }}>
                      <Link2 size={14} />Copy link
                    </button>
                    <div className="menusep" />
                    <button className="dang" onClick={() => { setActions(false); setModal("cancelEco"); }}>
                      <Ban size={14} />Cancel this change
                    </button>
                  </div>
                </>)}
              </div>
            )}
            {renderHeaderActions?.()}
          </div>
        </div>
      </div>
      <div className="card" style={{
        padding: "16px 24px 20px",
        paddingLeft: "100px"
      }}>
        <Lifecycle
          stages={LC}
          current={rejected ? "Approval" : eco.stage}
          rejected={rejected}
          sub={approvalState.requiredCount > 0 ? [Math.round((approvalState.decidedCount / approvalState.requiredCount) * 100), 0] : [60, 0]}
        />
      </div>
      {/* Combined Where this stands band + AI Rejection Insight */}
      <WhereThisStandsBand
        eco={eco}
        rejectedNotice={
          (rejected || withdrawnForRework) ? (
            <div
              style={{
                padding: "14px 16px",
                background: withdrawnForRework ? "#FFFBEB" : "#FFF5F5",
                color: withdrawnForRework ? "#92400E" : T.bad,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
              data-test-id="rejection-ai-insight-band"
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <AlertTriangle size={18} color={withdrawnForRework ? "#D97706" : T.bad} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: withdrawnForRework ? "#92400E" : T.bad }}>
                    {withdrawnForRework
                      ? `Withdrawn for rework — was rejected by ${eco.rejectedBy || 'a reviewer'}.`
                      : eco.rejectedBy
                        ? `Rejected by ${eco.rejectedBy}.`
                        : 'Rejected by Carol Nosworthy (Quality Assurance) on 09/06/2026.'}
                  </div>
                  <div style={{ marginTop: 3, fontSize: 13, color: withdrawnForRework ? "#78350F" : "#486581" }}>
                    {(eco.rejectionReason || eco.rejectionNotes) ? (
                      <>
                        {eco.rejectionReason && <strong>{eco.rejectionReason}</strong>}
                        {eco.rejectionReason && eco.rejectionNotes && ' — '}
                        {eco.rejectionNotes && `"${eco.rejectionNotes}"`}
                        {withdrawnForRework && <em style={{ marginLeft: 8, opacity: 0.75 }}> Address this before resubmitting.</em>}
                      </>
                    ) : (
                      '“Deviation evidence not attached. Reactivation needs the last inspection report before I can sign.”'
                    )}
                  </div>
                </div>
              </div>
              <button
                className="btn dan sm"
                type="button"
                style={{ flexShrink: 0 }}
                onClick={() => setAiReview(!aiReview)}
              >
                <Sparkles size={12} />
                {aiReview ? "Close rework plan" : "Draft rework plan"}
              </button>
            </div>
          ) : null
        }
      />
      {aiReview && (
        <Card title="Rework plan" sub="Drafted from the rejection notes on this change — edit before you act"
          right={<button className="btn gh sm" onClick={() => setAiReview(false)}><X size={13} /></button>}>
          <ol className="bulletlist" style={{ paddingLeft: 18 }}>
            <li><b>Withdraw the change to Open.</b> Items cannot be edited in Approval.</li>
            <li><b>Document control can close this one.</b> The missing item is an inspection report, not an engineering change — attach
              INSP-2026-0448 to item 1002261-01 under Files. No engineer round-trip needed.</li>
            <li><b>Notify the requester</b> Brian Johmann so the rejection email does not sit unanswered.</li>
            <li><b>Re-submit to ECO Construction.</b> The five approvers who already signed will be asked again; their prior decisions are kept in History.</li>
          </ol>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn pri" onClick={() => setModal("withdraw")}>Withdraw and start rework</button>
            <button className="btn">Email the requester</button>
          </div>
        </Card>
      )}
      <Card pad={false}>
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
        <div style={{ padding: 16 }}>

          {tab === "Summary" && (
            <div className="stack">
              {(eco.id === "ECO-010870" || (eco.notes && eco.notes.includes("Unique-parts cascade"))) && (
                <div
                  style={{
                    background: "linear-gradient(to right, rgba(5, 90, 175, 0.06), rgba(5, 90, 175, 0.02)), #ffffff",
                    borderRadius: 10,
                    border: "none",
                    boxShadow: "0 1px 2px rgba(2,42,66,.05), 0 10px 26px -14px rgba(2,42,66,.20)",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                  data-test-id="summary-ai-insight-cascade"
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: T.brand,
                    }}
                    data-test-id="summary-ai-insight-header"
                  >
                    <Sparkles size={12} strokeWidth={2.2} color={T.brand} />
                    <span>AI INSIGHT</span>
                  </div>

                  <div style={{ fontSize: 13, color: T.g900, lineHeight: 1.5, fontWeight: 600 }} data-test-id="summary-ai-insight-body">
                    Cascade verified: 1 unique part updated across 2 parent assemblies
                  </div>

                  <div style={{ fontSize: 11, color: T.g600, lineHeight: 1.4 }} data-test-id="summary-ai-insight-sub">
                    Applied because child part was unique to these assemblies. Child revisions are locked.
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                    <button
                      className="btn pri sm"
                      onClick={() => go({ page: "inactivate", id: eco.pns?.[0] || "01-080401-03" })}
                      data-test-id="summary-review-cascade-btn"
                    >
                      Review cascade
                    </button>
                  </div>
                </div>
              )}

              <div className="grid2" data-test-id="eco-visible-fields">
                <SpecList rows={[
                  ["Routing", eco.routing],
                  ["Site", eco.site]
                ]} />
                <SpecList rows={[
                  ["Effectivity", "This change becomes effective once approved"],
                  ["Approval Deadline", "None specified"]
                ]} />
              </div>

              <div style={{ marginTop: 2 }}>
                <h3 style={{ marginBottom: 8 }} data-test-id="eco-details-disclosure-btn">Details</h3>
                <div data-test-id="eco-details-disclosure-content">
                    <div className="grid2">
                      <SpecList rows={[
                        ["Category", eco.cat],
                        ["Change Number", eco.id],
                        ["Title", eco.title],
                        ["Division", eco.div === "AG" ? "AG – Agriculture" : "CO – Construction"],
                        ["Validations Complete?", "N/A"],
                        ["Seed Stock Approved?", "N/A"],
                        ["Inventory Disposition Filled?", "Yes"],
                        ["DC Rep", eco.dc],
                        ["Status Notes", (eco.notes && eco.notes.includes("Unique-parts cascade")) ? "—" : (eco.notes || "—")]
                      ]} />
                      <SpecList rows={[
                        ["Expiration Date", "N/A (this is a permanent change)"],
                        ["Lifecycle Status", eco.stage],
                        ["Creator", eco.creator],
                        ["Submitter", eco.submitter],
                        ["Created On", eco.created],
                        ["Submitted On", eco.submitted],
                        ["Reference Files", "1"],
                        ["Implementation Files", "0"]
                      ]} />
                    </div>
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <h3 style={{ marginBottom: 6 }}>Description</h3>
                <div className="sub" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{eco.desc}</div>
              </div>
              {eco.redline && (
                <div>
                  <h3 style={{ marginBottom: 6 }}>Redline instructions</h3>
                  <pre style={{ margin: 0, padding: 12, background: T.g50, border: `1px solid ${T.g200}`, borderRadius: 6,
                    fontSize: 11, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{eco.redline}</pre>
                </div>
              )}
            </div>
          )}

          {tab === "Items" && (
            <div className="stack">
              <div className="bet">
                <div className="seg">
                  {["Modifications", "BOM Redline", "Affected Assemblies", "Inventory Disposition"].map((x: any) => (
                    <button key={x} className={itemSub === x ? "on" : ""} onClick={() => setItemSub(x)}>{x}</button>
                  ))}
                </div>

              </div>

              {itemSub === "Modifications" && (() => {
                const isECO010870 = eco.id === "ECO-010870";
                // Build item rows from ecoItems (now always stored on backend records).
                // Fall back to pnsJson-derived rows for records that predate ecoItemsJson.
                const ecoItemsList = backendCo && eco.ecoItems && eco.ecoItems.length > 0
                  ? eco.ecoItems.map((ki: any) => {
                      const adds = (ki.bomEdits ?? []).filter((e: any) => e.type === 'ADD').length;
                      const dels = (ki.bomEdits ?? []).filter((e: any) => e.type === 'DELETE').length;
                      const upds = (ki.bomEdits ?? []).filter((e: any) => e.type === 'UPDATE_DESC' || e.type === 'UPDATE_QTY').length;
                      const parts = [adds > 0 ? `${adds} add` : '', dels > 0 ? `${dels} delete` : '', upds > 0 ? `${upds} update` : ''].filter(Boolean);
                      return {
                        pn: ki.pn,
                        name: ki.name ?? `Part ${ki.pn}`,
                        phase: "In Production",
                        newPhase: "In Production",
                        rev: ki.currentRev ?? ki.rev ?? 'A',
                        newRev: ki.newRev ?? 'B',
                        bom: parts.length > 0 ? parts.join(' · ') : null,
                        bomCount: (ki.bomEdits ?? []).length,
                        specs: true,
                      };
                    })
                  : backendCo && eco.pns && eco.pns.length > 0
                  ? eco.pns.map((pn: string) => ({
                      pn, name: `Part ${pn}`, phase: "In Production", newPhase: "In Production",
                      rev: "A", newRev: "B", bom: null, bomCount: 0, specs: true,
                    }))
                  : null;
                const itemsList = isECO010870 ? ECO_010870_ITEMS
                  : ecoItemsList ?? [
                      { pn: "1003140-01", name: "KIT, TS CG MOUNTING", phase: "In Production", newPhase: "In Production", rev: "B", newRev: "C", bom: "2 add · 1 delete", specs: true }
                    ];
                const pageSize = 25;
                const totalItems = itemsList.length;
                const totalPages = Math.ceil(totalItems / pageSize);
                const currentPage = isECO010870 ? Math.min(Math.max(modPage, 1), totalPages) : 1;
                const startIndex = (currentPage - 1) * pageSize;
                const endIndex = Math.min(startIndex + pageSize, totalItems);
                const currentRows = isECO010870 ? itemsList.slice(startIndex, endIndex) : itemsList;

                const allCurrentSelected = currentRows.length > 0 && currentRows.every((r: any) => selectedPns.includes(r.pn));
                const toggleSelectAllCurrent = () => {
                  if (allCurrentSelected) {
                    setSelectedPns(selectedPns.filter((pn: any) => !currentRows.some((r: any) => r.pn === pn)));
                  } else {
                    const toAdd = currentRows.map((r: any) => r.pn).filter((pn: any) => !selectedPns.includes(pn));
                    setSelectedPns([...selectedPns, ...toAdd]);
                  }
                };

                return (
                  <>
                    <div className="bet" style={{ marginBottom: 4 }}>
                      <div className="sub">{eco.items} item{eco.items > 1 ? "s" : ""} with {eco.mods} requested modifications</div>
                      {isECO010870 && totalItems > 0 && (
                        <div className="sub" style={{ fontWeight: 600 }} data-test-id="mod-count-line-top">
                          Showing {startIndex + 1}-{endIndex} of 129
                        </div>
                      )}
                    </div>
                    <div className="card" style={{ overflow: "hidden" }}>
                      <table className="tbl" data-test-id="modifications-table">
                      <thead>
                        <tr>
                          <th style={{ width: 30 }}>
                            <input
                              type="checkbox"
                              checked={allCurrentSelected}
                              onChange={toggleSelectAllCurrent}
                              title="Select / deselect page items"
                            />
                          </th>
                          <th style={{ width: 44 }}>#</th>
                          <th>Item number</th>
                          <th>Item name</th>
                          <th>Phase</th>
                          <th>New phase</th>
                          <th>Rev</th>
                          <th>New rev</th>
                          <th>BOM</th>
                          <th>Specs</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentRows.map((row: any, idx: any) => {
                          const globalIdx = startIndex + idx + 1;
                          const isChecked = selectedPns.includes(row.pn);
                          return (
                            <tr key={row.pn} className={isChecked ? "sel" : ""}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedPns(selectedPns.filter((p: any) => p !== row.pn));
                                    } else {
                                      setSelectedPns([...selectedPns, row.pn]);
                                    }
                                  }}
                                />
                              </td>
                              <td style={{ color: T.g600, fontSize: 13 }}>{globalIdx}</td>
                              <td>
                                <a className="pn" style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' }} onClick={() => go({ page: "item", id: row.pn })}>
                                  {row.pn}
                                </a>
                              </td>
                              <td style={{ fontWeight: 600 }}>{row.name}</td>
                              <td>{phaseChip(row.phase)}</td>
                              <td>{phaseChip(row.newPhase)}</td>
                              <td>{row.rev}</td>
                              <td><b>{row.newRev}</b></td>
                              <td>
                                {row.bom ? (
                                  <Chip k="blue">{row.bom}</Chip>
                                ) : (
                                  <span className="mut">—</span>
                                )}
                              </td>
                              <td>
                                {row.specs ? (
                                  <Check size={13} color={T.ok} strokeWidth={2.5} />
                                ) : (
                                  <span className="mut">—</span>
                                )}
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <button
                                  className="btn sm"
                                  onClick={() => {
                                    setActiveRedlineItem(row);
                                    setItemSub("BOM Redline");
                                  }}
                                  data-test-id={`view-redline-btn-${row.pn}`}
                                >
                                  View Redline
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>

                    {isECO010870 && totalPages > 1 && (
                      <div className="bet" style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${T.g200}` }}>
                        <div className="sub" data-test-id="mod-count-line">
                          Showing {startIndex + 1}-{endIndex} of 129
                        </div>
                        <div className="row" style={{ gap: 6 }}>
                          <button
                            className="btn sm"
                            disabled={currentPage === 1}
                            onClick={() => setModPage(currentPage - 1)}
                            style={{ opacity: currentPage === 1 ? 0.45 : 1, cursor: currentPage === 1 ? "default" : "pointer" }}
                            data-test-id="mod-page-prev"
                          >
                            <ChevronLeft size={13} strokeWidth={2} />
                            Previous
                          </button>
                          <div className="row" style={{ gap: 3 }}>
                            {Array.from({ length: totalPages }, (_: any, p: any) => p + 1).map((pg: any) => (
                              <button
                                key={pg}
                                className={`btn sm ${currentPage === pg ? "pri" : "gh"}`}
                                onClick={() => setModPage(pg)}
                                style={{ minWidth: 28, padding: "0 6px", height: 27 }}
                                data-test-id={`mod-page-${pg}`}
                              >
                                {pg}
                              </button>
                            ))}
                          </div>
                          <button
                            className="btn sm"
                            disabled={currentPage === totalPages}
                            onClick={() => setModPage(currentPage + 1)}
                            style={{ opacity: currentPage === totalPages ? 0.45 : 1, cursor: currentPage === totalPages ? "default" : "pointer" }}
                            data-test-id="mod-page-next"
                          >
                            Next
                            <ChevronRight size={13} strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {itemSub === "BOM Redline" && (() => {
                // Use eco.affectedAssembly as the primary data source for the redlined kit
                const aa = eco.affectedAssembly;
                const target = redlineTarget;

                // Build BOM rows: prefer affectedAssembly, then ecoItems (from creation), then static fallback
                const bomRowsFromAA = aa
                  ? aa.bomEdits.map((e: any) => ({
                      pn: e.pn, rev: "—", name: e.name, cat: "—", phase: "—",
                      qty: e.qty || "—",
                      st: e.op === "ADD" ? "add" : e.op === "DELETE" ? "del" : "upd",
                      op: e.op,
                      newValue: e.newValue,
                      warn: e.warn,
                    }))
                  : null;

                // From ecoItems stored at creation time — find the kit matching the selected/primary pn
                const ecoItemEdits = (() => {
                  if (!eco.ecoItems || eco.ecoItems.length === 0) return null;
                  const kitPn = activeRedlineItem?.pn ?? eco.ecoItems[0]?.pn;
                  const kit = eco.ecoItems.find((ki: any) => ki.pn === kitPn) ?? eco.ecoItems[0];
                  if (!kit) return null;
                  // Return empty array (not null) when kit exists but has no BOM edits
                  return kit.bomEdits.map((e: any) => ({
                    id: e.id,
                    pn: e.pn, rev: "—", name: e.name, cat: "—", phase: "—",
                    qty: e.qty || "—",
                    st: e.type === "ADD" ? "add" : e.type === "DELETE" ? "del" : "upd",
                    op: e.type,
                    newValue: e.newValue,
                    warn: e.warn,
                  }));
                })();

                // Only fall back to static demo data when this is the specific demo ECO (ECO-010870)
                const staticFallback = eco.id === "ECO-010870" ? BOM_1003140 : [];
                const bomRows = bomRowsFromAA ?? ecoItemEdits ?? staticFallback;

                // Title/sub: prefer the linked affected assembly data, fall back to ecoItems or target
                const firstEcoItem = eco.ecoItems?.[0];
                const redlineTitle = aa
                  ? `${aa.pn} — ${aa.name}`
                  : target
                  ? `${target.pn} — ${target.name}`
                  : firstEcoItem
                  ? `${firstEcoItem.pn} — ${firstEcoItem.name}`
                  : "No BOM redline recorded";
                const redlineSub = (() => {
                  if (aa) {
                    const adds = aa.bomEdits.filter((e: any) => e.op === "ADD").length;
                    const dels = aa.bomEdits.filter((e: any) => e.op === "DELETE").length;
                    return `Rev ${aa.fromRev} → Rev ${aa.toRev} · ${adds} addition${adds !== 1 ? "s" : ""}, ${dels} removal${dels !== 1 ? "s" : ""}`;
                  }
                  if (ecoItemEdits) {
                    const adds = ecoItemEdits.filter((e: any) => e.st === "add").length;
                    const dels = ecoItemEdits.filter((e: any) => e.st === "del").length;
                    const counts = [adds > 0 ? `${adds} addition${adds !== 1 ? "s" : ""}` : "", dels > 0 ? `${dels} removal${dels !== 1 ? "s" : ""}` : ""].filter(Boolean).join(", ");
                    const kitPn2 = activeRedlineItem?.pn ?? eco.ecoItems?.[0]?.pn;
                    const kit2 = eco.ecoItems?.find((ki: any) => ki.pn === kitPn2) ?? eco.ecoItems?.[0];
                    const revPart = kit2 ? `Rev ${kit2.rev} → Rev ${kit2.newRev}` : "";
                    return [revPart, counts || "No BOM edits"].filter(Boolean).join(" · ");
                  }
                  if (target) return `Rev ${target.rev} → Rev ${target.newRev} · ${target.bom || "Inactivation redline"}`;
                  if (firstEcoItem) return `Rev ${firstEcoItem.currentRev ?? firstEcoItem.rev} → Rev ${firstEcoItem.newRev ?? firstEcoItem.rev} · No BOM edits recorded`;
                  return "No BOM edits recorded";
                })();

                // Parts already in the redline — exclude from picker
                const existingPns = new Set(bomRows.map((r: any) => r.pn))
                // Unique BOM parts filtered by search query
                const filteredKitItems = uniqueBomParts.filter((it) =>
                  !existingPns.has(it.pn) &&
                  (addItemQ === '' ||
                    it.pn.toLowerCase().includes(addItemQ.toLowerCase()) ||
                    it.name.toLowerCase().includes(addItemQ.toLowerCase()))
                )

                return (
                  <>
                    {/* ── Add Item modal ─────────────────────────────────── */}
                    {addItemOpen && (
                      <div
                        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={() => setAddItemOpen(false)}
                        data-test-id="add-bom-item-overlay"
                      >
                        <div
                          className="card"
                          style={{ width: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 0, borderRadius: 12, overflow: 'hidden' }}
                          onClick={(e) => e.stopPropagation()}
                          data-test-id="add-bom-item-modal"
                        >
                          {/* Header */}
                          <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${T.g200}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: 15 }}>Add item to BOM</div>
                              <div className="sub" style={{ marginTop: 2 }}>Select a kit or assembly to add as an ADD edit on this redline</div>
                            </div>
                            <button
                              className="btn gh"
                              style={{ padding: '4px 8px' }}
                              onClick={() => { setAddItemOpen(false); setAddItemQ('') }}
                              data-test-id="add-bom-item-close"
                            >✕</button>
                          </div>
                          {/* Search + qty */}
                          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${T.g200}`, display: 'flex', gap: 8 }}>
                            <input
                              className="inp"
                              style={{ flex: 1 }}
                              placeholder="Search by PN or name…"
                              value={addItemQ}
                              onChange={(e) => setAddItemQ(e.target.value)}
                              autoFocus
                              data-test-id="add-bom-item-search"
                            />
                            <input
                              className="inp"
                              style={{ width: 90 }}
                              placeholder="Qty"
                              value={addItemQty}
                              onChange={(e) => setAddItemQty(e.target.value)}
                              data-test-id="add-bom-item-qty"
                            />
                          </div>
                          {/* Item list */}
                          <div style={{ flex: 1, overflowY: 'auto' }} data-test-id="add-bom-item-list">
                            {bomItemsLoading ? (
                              <div style={{ padding: 24, textAlign: 'center', color: T.g500, fontSize: 13 }}>
                                Loading parts…
                              </div>
                            ) : filteredKitItems.length === 0 ? (
                              <div style={{ padding: 24, textAlign: 'center', color: T.g500, fontSize: 13 }}>
                                {addItemQ ? 'No parts match your search' : 'All parts are already in the redline'}
                              </div>
                            ) : (
                              <table className="tbl">
                                <thead><tr><th>Part number</th><th>Name</th><th>Category</th><th></th></tr></thead>
                                <tbody>
                                  {filteredKitItems.slice(0, 100).map((it) => (
                                    <tr key={it.pn} data-test-id={`add-bom-item-row-${it.pn}`}>
                                      <td className="pn">{it.pn}</td>
                                      <td>{it.name}</td>
                                      <td><span className="mut">{it.cat}</span></td>
                                      <td style={{ textAlign: 'right' }}>
                                        <button
                                          className="btn sm pri"
                                          onClick={() => handleAddBomItem(it, addItemQty || '1 EA')}
                                          data-test-id={`add-bom-item-select-${it.pn}`}
                                        >Add</button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── BOM Redline card ───────────────────────────────── */}
                    <Card title={redlineTitle} sub={redlineSub} pad={false}
                      right={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Chip k="gray">Editable by requester and document control</Chip>
                          {backendCo && (
                            <button
                              className="btn sm pri"
                              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                              onClick={() => setAddItemOpen(true)}
                              data-test-id="bom-redline-add-item-btn"
                            >
                              <Plus size={13} />Add item
                            </button>
                          )}
                        </div>
                      }
                      data-test-id="bom-redline-card">
                      <table className="tbl" data-test-id="bom-redline-table">
                        <thead><tr><th>#</th><th>Item number</th><th>Item name</th><th>Qty</th><th>Change</th><th></th></tr></thead>
                        <tbody>
                          {bomRows.map((b2: any, k: any) => (
                            <React.Fragment key={`${b2.pn}-${k}`}>
                              <tr data-test-id={`bom-redline-row-${b2.pn}`} style={b2.warn ? { background: T.warnBg } : undefined}>
                                <td>{k + 1}</td>
                                <td className={b2.st === "del" ? "del" : "pn"}>
                                  {b2.warn && <AlertCircle size={11} style={{ color: T.warn, marginRight: 4, verticalAlign: 'middle' }} />}
                                  {b2.pn}
                                </td>
                                <td className={b2.st === "del" ? "del" : b2.st === "add" ? "add" : ""}>
                                  {b2.name}
                                  {b2.op === "UPDATE_DESC" && b2.newValue && (
                                    <span className="mut" style={{ marginLeft: 8 }}>→ {b2.newValue}</span>
                                  )}
                                </td>
                                <td>{b2.qty}</td>
                                <td>
                                  {b2.st === "add" ? <Chip k="ok">Added</Chip>
                                    : b2.st === "del" ? <Chip k="bad">Removed</Chip>
                                    : b2.op === "UPDATE_DESC" ? <Chip k="blue">Desc updated</Chip>
                                    : b2.op === "UPDATE_QTY" ? <Chip k="warn">Qty updated</Chip>
                                    : <span className="mut">Unchanged</span>}
                                </td>
                                <td style={{ textAlign: 'right', width: 36 }}>
                                  {backendCo && b2.id && (
                                    <button
                                      className="btn gh sm"
                                      style={{ padding: '2px 6px', color: '#dc2626' }}
                                      onClick={() => handleDeleteBomEdit(b2.id)}
                                      title="Remove from redline"
                                      data-test-id={`bom-redline-delete-${b2.pn}`}
                                    ><Trash2 size={12} /></button>
                                  )}
                                </td>
                              </tr>
                              {b2.warn && (
                                <tr data-test-id={`bom-redline-warn-${b2.pn}`}>
                                  <td colSpan={6} style={{ padding: '4px 10px 8px', background: T.warnBg }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.warn, fontSize: 11 }}>
                                      <AlertCircle size={11} />{b2.warn}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  </>
                );
              })()}

              {itemSub === "Affected Assemblies" && (() => {
                // Read from the stored backend snapshot. If absent (seed ECOs pre-dating
                // this field), derive on-the-fly from the kit's ecoItems so every ECO
                // shows real data without requiring a manual back-fill.
                const stored: AffectedAssemblyEntry[] = (eco as any).affectedAssemblies ?? []
                const affRows: AffectedAssemblyEntry[] = stored.length > 0
                  ? stored
                  : deriveAffectedAssemblies(
                      eco.ecoItems.map((it) => ({ pn: it.pn, name: it.name, bomEdits: it.bomEdits ?? [] }))
                    )
                const hasWorkInstructionWarning = affRows.some((r) => r.impact.includes("still references"));

                return (
                  <>
                    <div className="sub">
                      Parent assemblies that contain an item on this change — derived from the BOM at submission time.
                      These assemblies are not being redlined, but they inherit the revision result.
                    </div>
                    {affRows.length === 0 ? (
                      <div className="card" style={{ padding: 24, textAlign: "center", color: T.g500, fontSize: 13 }}>
                        No parent assemblies found for the items on this change.
                      </div>
                    ) : (
                      <div className="card" style={{ overflow: "hidden" }}>
                        <table className="tbl" data-test-id="affected-assemblies-table">
                          <thead>
                            <tr>
                              <th>Parent item</th>
                              <th>Name</th>
                              <th>Contains</th>
                              <th>Level</th>
                              <th>Phase</th>
                              <th>Division</th>
                              <th>Impact</th>
                            </tr>
                          </thead>
                          <tbody>
                            {affRows.map((r, idx) => (
                              <tr key={`${r.parentPn}-${r.containsPn}-${idx}`} data-test-id={`affected-row-${r.parentPn}`}>
                                <td>
                                  <a className="pn" style={{ fontFamily: 'ui-monospace,"SF Mono",Menlo,Consolas,monospace', fontSize: 12 }}
                                    onClick={() => go({ page: "item", id: r.parentPn })}>{r.parentPn}</a>
                                </td>
                                <td style={{ fontWeight: 500 }}>{r.parentName}</td>
                                <td>
                                  <span className="pn" style={{ fontFamily: 'ui-monospace,"SF Mono",Menlo,Consolas,monospace', fontSize: 12 }}>{r.containsPn}</span>
                                </td>
                                <td className="sub">Level {r.level}</td>
                                <td>{phaseChip(r.phase)}</td>
                                <td><Chip k={r.div === "AG" ? "teal" : "gray"}>{r.div}</Chip></td>
                                <td className="sub" style={{ color: r.impact.includes("still references") ? T.warn : T.g600 }}>
                                  {r.impact}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {hasWorkInstructionWarning && (
                      <div className="warnbox" data-test-id="affected-assemblies-warning">
                        A parent assembly still references a removed item in its assembly instructions.
                        That document sits outside this change — raise a DCO or add it here before the change goes effective.
                      </div>
                    )}
                  </>
                );
              })()}

              {itemSub === "Inventory Disposition" && (() => {
                // Read from the stored backend snapshot. If absent (seed ECOs pre-dating
                // this field), derive on-the-fly so every ECO shows real data.
                const storedDisp: InventoryDispositionEntry[] = (eco as any).inventoryDisposition?.length > 0
                  ? (eco as any).inventoryDisposition
                  : deriveInventoryDisposition(
                      eco.ecoItems.map((it) => ({ pn: it.pn, name: it.name, bomEdits: it.bomEdits ?? [] }))
                    )
                const allHaveDisposition = storedDisp.length > 0 && storedDisp.every((r) => !!r.disposition)

                if (storedDisp.length === 0) {
                  return (
                    <div className="card" style={{ padding: 24, textAlign: "center", color: T.g500, fontSize: 13 }} data-test-id="inv-disp-empty">
                      No inventory disposition data — this change predates automated disposition tracking,
                      or no items with BOM edits were added.
                    </div>
                  )
                }

                return (
                  <>
                    <div className="sub">What happens to stock already on hand when this change goes effective. Required before document control can sign.</div>
                    <div className="card" style={{ overflow: "hidden" }} data-test-id="inv-disp-table">
                      <table className="tbl">
                        <thead><tr>
                          <th>Item number</th><th>Item name</th>
                          <th style={{ textAlign: "right" }}>On hand</th>
                          <th style={{ textAlign: "right" }}>In WIP</th>
                          <th style={{ textAlign: "right" }}>On order</th>
                          <th style={{ width: 160 }}>Disposition</th>
                          <th>Notes</th>
                        </tr></thead>
                        <tbody>
                          {storedDisp.map((r) => (
                            <tr key={r.pn} data-test-id={`inv-disp-row-${r.pn}`}>
                              <td className="pn">{r.pn}</td>
                              <td>{r.name}</td>
                              <td style={{ textAlign: "right" }}>{r.onHand.toLocaleString()}</td>
                              <td style={{ textAlign: "right" }}>{r.inWip ? r.inWip.toLocaleString() : <span className="mut">—</span>}</td>
                              <td style={{ textAlign: "right" }}>{r.onOrder ? r.onOrder.toLocaleString() : <span className="mut">—</span>}</td>
                              <td>
                                <Select
                                  style={{ height: 28 }}
                                  options={["Use up", "Scrap", "Rework", "Return to supplier", "N/A — added", "N/A — deleted", "N/A"]}
                                  value={r.disposition}
                                />
                              </td>
                              <td><Input style={{ height: 28 }} placeholder="Optional note" defaultValue={r.notes} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {allHaveDisposition && (
                      <div className="okbox" data-test-id="inv-disp-complete">
                        <CheckCircle2 size={15} />
                        <div><b>All items have a disposition.</b> This satisfies the confirmation on the summary page.</div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {tab === "Files" && (
            <div className="stack" data-test-id="eco-files-tab">
              <div>
                <h3>Files on this change</h3>
                <div className="sub" style={{ marginTop: 3 }}>Reference files support the decision. Implementation files are what manufacturing works from once the change goes effective.</div>
              </div>
              <FileUpload
                onClose={() => {}}
                context="this change order"
                hideCancel
                coId={eco.id}
                uploadedBy={ME.name}
                data-test-id="eco-file-upload"
              />
            </div>
          )}

          {tab === "Approvals" && (() => {
            const { decidedCount: done, requiredCount: req } = approvalState;
            const pct = req > 0 ? Math.round((done / req) * 100) : 0;
            const groups = [...new Set(APPROVALS.map((x: any) => x.g))];
            return (
              <div className="stack">
                <div className="note"><Info size={13} style={{ verticalAlign: -2 }} /> Suppliers from different companies cannot see each
                  other on this change.</div>

                {/* ---- section one: the approval flow ---- */}
                <div className="sectionhead">
                  <span className="secnum">1</span>
                  <div><b>Approval flow</b>
                    <div className="mini" style={{ marginTop: 2 }}>Functional roles review in parallel. Every required role must decide
                      before document control can sign.</div></div>
                  <div className="row" style={{ marginLeft: "auto", gap: 12 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: T.brand }}>{done} of {req}</div>
                      <div className="mini">decisions in</div>
                    </div>
                    <div className="ring" style={{ background: `conic-gradient(${T.brand} ${pct * 3.6}deg, ${T.g200} 0)` }}>
                      <span>{pct}%</span>
                    </div>
                  </div>
                </div>

                {groups.map((g: any) => {
                  const members = APPROVALS.filter((x: any) => x.g === g);
                  const isCommentsOnly = members[0].req === "Comments only";
                  const gdone = isCommentsOnly || members.some((m: any) => m.st === "approved");
                  const opt = members[0].req === "Optional";
                  return (
                    <div key={g} className={`apgroup ${gdone ? "done" : opt ? "opt" : ""}`}>
                      <div className="apghead">
                        <span className="apgdot">{gdone ? <Check size={11} color="#fff" strokeWidth={3.5} />
                          : opt ? <Ban size={10} color={T.g500} /> : <Clock size={10} color={T.warn} />}</span>
                        <b>{g}</b>
                        <Chip k={isCommentsOnly ? "gray" : members[0].req === "Optional" ? "gray" : "blue"}>{members[0].req}</Chip>
                        {isCommentsOnly ? <Chip k="gray">Comments recorded</Chip> : gdone ? <Chip k="ok">Satisfied</Chip> : opt ? <Chip k="gray">Skipped</Chip> : <Chip k="warn">Waiting</Chip>}
                        <div className="row" style={{ marginLeft: "auto", gap: 5 }}>
                          {members.map((m: any) => (
                            <span key={m.n} className={`ava2 sm ${m.st === "approved" ? "ok" : ""}`} title={`${m.n} — ${m.st}`}>
                              {m.n.split(" ").map((x: any) => x[0]).join("").slice(0, 2)}</span>
                          ))}
                        </div>
                      </div>
                      <table className="tbl">
                        <tbody>
                          {members.map((m: any) => (
                            <tr key={m.n}>
                              <td style={{ width: 34 }}>{m.st === "approved" ? <Check size={14} color={T.ok} strokeWidth={3} />
                                : m.st === "comments" ? <FileText size={13} color={T.g400} />
                                : m.st === "skipped" ? <Ban size={13} color={T.g400} /> : <Circle size={13} color={T.g400} />}</td>
                              <td style={{ fontWeight: 600, width: 190 }}>{m.n}</td>
                              <td style={{ width: 130 }}>{m.st === "approved" ? <Chip k="ok">Approved</Chip>
                                : m.st === "comments" ? <Chip k="gray">Comments recorded</Chip>
                                : m.st === "skipped" ? <Chip k="gray">Skipped</Chip> : <Chip k="warn">Waiting</Chip>}</td>
                              <td className="sub" style={{ width: 170 }}>{m.at || "—"}</td>
                              <td className="sub">{m.cm || <span className="mut">No comment</span>}</td>
                              <td style={{ textAlign: "right", width: 110 }}>
                                {m.st === "pending" && (
                                  <button
                                    className="btn sm"
                                    data-test-id={`remind-btn-${m.n}`}
                                    onClick={() => {
                                      sendReminder(eco.id, m.n)
                                        .then(() => toast.success(`Reminder sent to ${m.n}`))
                                        .catch(() => toast.error(`Failed to send reminder to ${m.n}`))
                                    }}
                                  >
                                    <Bell size={12} />Remind
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}

                {/* Stage 2 is complete when the CO has moved past Approval */}
                {(() => {
                  const isStage2Complete = eco.stage === 'Complete' || eco.stage === 'Effective';
                  const dcGroupName = (ROUTINGS[eco.routing] || []).filter((r: any) => r.stage === 2).map((r: any) => r.g).join(", ") || "Document Control TPS – Livermore";
                  const dcMembers = (ROUTINGS[eco.routing] || []).filter((r: any) => r.stage === 2)[0]?.members || [ME.name, "Adam Royce"];
                  const DC_CHECKS: [string, boolean][] = [
                    ["Redline matches the description on the summary page", true],
                    ["Compliance tab reviewed for every item", true],
                    ["Files and sourcing checked, or confirmed not required", true],
                    ["Supplier access and notifications set", true],
                    ["Inventory disposition filled for all items", isStage2Complete],
                  ];
                  return (
                    <>
                      <div className="gatebar">
                        <span className="gateline" />
                        <span className="gatepill">
                          {isStage2Complete
                            ? <><Check size={12} />Stage 1 complete — Stage 2 signed off</>
                            : <><Clock size={12} />Stage 2 unlocks when every required role above has decided</>}
                        </span>
                        <span className="gateline" />
                      </div>

                      {/* ---- section two: document control ---- */}
                      <div className="sectionhead">
                        <span className="secnum">2</span>
                        <div><b>Document control check</b>
                          <div className="mini" style={{ marginTop: 2 }}>The gatekeeper. Verifies the redline against the description, then
                            releases the change to the effective stage and the SAP write-back.</div></div>
                        {isStage2Complete
                          ? <Chip k="ok" icon={Check}>Completed</Chip>
                          : <Chip k="gray" icon={Clock}>Locked</Chip>}
                      </div>

                      <div className={`apgroup ${isStage2Complete ? "done" : "locked"}`}>
                        <div className="apghead">
                          <span className="apgdot">
                            {isStage2Complete
                              ? <Check size={11} color="#fff" strokeWidth={3.5} />
                              : <Clock size={10} color={T.g500} />}
                          </span>
                          <b>{dcGroupName}</b>
                          <Chip k="blue">One or more</Chip>
                          {isStage2Complete && <Chip k="ok">Signed off</Chip>}
                          <div className="row" style={{ marginLeft: "auto", gap: 5 }}>
                            {dcMembers.map((m: any) => (
                              <span key={m} className={`ava2 sm ${isStage2Complete ? "ok" : ""}`} title={m}>{initials(m)}</span>
                            ))}
                          </div>
                        </div>
                        <div style={{ padding: 14 }}>
                          <div className="checklist">
                            {DC_CHECKS.map(([l, ok2]) => (
                              <label key={l} className="row" style={{ gap: 9 }}>
                                <input type="checkbox" checked={ok2} readOnly disabled />
                                <span style={{ fontSize: 13, color: ok2 ? T.g900 : T.g600 }}>{l}</span>
                              </label>
                            ))}
                          </div>
                          <div className="bet" style={{ marginTop: 14 }}>
                            {isStage2Complete
                              ? <span className="mini" style={{ color: T.ok }}>All checks passed — change released to Effective.</span>
                              : <span className="mini">Four of five checks pass. The last one opens once stage 1 clears.</span>}
                            <button className="btn ok" disabled>
                              <Check size={13} />
                              {isStage2Complete ? "Signed off and released" : "Sign off and release"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}

                <div className="aibox">
                  <div className="bet">
                    <div className="row"><Sparkles size={15} color={T.vio} />
                      <div><b>Pre-approval analysis</b>
                        <div className="sub" style={{ marginTop: 2 }}>
                          Every check an approver would do by hand, run before they open the change. They confirm the analysis instead of
                          repeating it — and can always disagree with it.
                        </div>
                      </div>
                    </div>
                    <button className="btn" onClick={() => setModal("analysis")}>Open analysis</button>
                  </div>
                </div>
              </div>
            );
          })()}

          {tab === "Supplier Access" && (() => {
            const isECO010870 = eco.id === "ECO-010870";
            const samplePns = isECO010870
              ? ["01-080401-03", "04-080401-10", "04-080401-11", "05-080401-01LF"]
              : ["1003140-01", "1002260-01", "1006394-01", "2505-0103"];
            return (
              <div className="stack">
                <div className="bet">
                  <div><h3>Suppliers on this change</h3>
                    <div className="sub" style={{ marginTop: 3 }}>Derived from the sourcing records of the items on the change. A part can be
                      dual sourced, so more than one supplier can appear for the same item.</div></div>
                  <button className="btn pri" onClick={() => setModal("share")}><Plus size={13} />Share with suppliers</button>
                </div>
                {shared.length === 0 ? (
                  <Empty icon={Users} title="Not shared with any supplier yet"
                    body="You can share at any point before the change completes. Suppliers only ever see their own parts."
                    action={<button className="btn" onClick={() => setModal("share")}>Choose suppliers</button>} />
                ) : (
                  <table className="tbl">
                    <thead><tr><th>Supplier</th><th>Parts they supply</th><th>Access</th><th>Notified on</th><th>Added by</th><th></th></tr></thead>
                    <tbody>
                      {suppliersFor(samplePns)
                        .filter((f: any) => shared.includes(f.n)).map((f: any) => (
                        <tr key={f.n}>
                          <td style={{ fontWeight: 600 }}>{f.n}</td>
                          <td><div className="row" style={{ flexWrap: "wrap", gap: 5 }}>
                            {f.parts.map((pn: any) => <span key={pn} className="chip c-blue">{pn}</span>)}</div></td>
                          <td><Chip k="gray">View only</Chip></td>
                          <td className="sub">Change complete</td>
                          <td className="sub">{ME.name}</td>
                          <td style={{ textAlign: "right" }}>
                            <button className="btn gh sm" onClick={() => setShared(shared.filter((x: any) => x !== f.n))}><Trash2 size={12} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="note">
                  {isECO010870
                    ? "Inactivation change sharing: external suppliers are notified upon ECO completion regarding obsolete parts."
                    : "1003140-01 is a sales kit with no sourcing record of its own, so sharing is driven by its components."}
                </div>
              </div>
            );
          })()}

          {tab === "Notifications" && (() => {
            const extraNames: string[] = (eco as any).extraNotifyNames ?? []
            let recipients: { name: string; reason: string; notifyOn: string; checked: boolean }[] = []

            if (backendCo) {
              // Build a lookup: name → role label, from the stored approvals
              const nameToRole = new Map<string, string>()
              const submitterName = eco.submitter && eco.submitter !== '—' ? eco.submitter : ME.name
              for (const entry of backendApprovals as import('@/data/changeOrders').ApprovalEntry[]) {
                const groupLabel = entry.role ?? ''
                if (entry.approver) nameToRole.set(entry.approver, groupLabel)
                for (const other of entry.others ?? []) nameToRole.set(other, groupLabel)
              }

              if (extraNames.length > 0) {
                // Primary path: extraNotifyNames is seeded at creation with the full approval flow.
                // Show each person with their reason derived from the approval role lookup.
                const map = new Map<string, { name: string; reason: string; notifyOn: string; checked: boolean }>()
                for (const name of extraNames) {
                  if (!name || map.has(name)) continue
                  let reason: string
                  if (name === submitterName) {
                    reason = nameToRole.has(name)
                      ? `Part of the approval board · submitted this change`
                      : 'Submitted this change'
                  } else if (nameToRole.has(name)) {
                    reason = `Part of the approval board · ${nameToRole.get(name)}`
                  } else {
                    reason = 'Manually added'
                  }
                  map.set(name, { name, reason, notifyOn: 'Every status change', checked: true })
                }
                recipients = Array.from(map.values())
              } else {
                // Fallback for COs created before extraNotifyNames was introduced:
                // derive dynamically from backendApprovals.
                const map = new Map<string, { name: string; reason: string; notifyOn: string; checked: boolean }>()
                const addPerson = (name: string, groupLabel: string, isSubmitter = false) => {
                  if (!name || name === '—') return
                  if (map.has(name)) {
                    const ex = map.get(name)!
                    if (!ex.reason.includes(groupLabel) && !ex.reason.includes('submitted this change')) {
                      ex.reason = `${ex.reason} · ${groupLabel}`
                    }
                  } else {
                    const reason = isSubmitter
                      ? 'Part of the approval board · submitted this change'
                      : `Part of the approval board · ${groupLabel}`
                    map.set(name, { name, reason, notifyOn: 'Every status change', checked: true })
                  }
                }
                addPerson(submitterName, '', true)
                for (const entry of backendApprovals as import('@/data/changeOrders').ApprovalEntry[]) {
                  const groupLabel = entry.role ?? ''
                  if (entry.approver) addPerson(entry.approver, groupLabel)
                  for (const other of entry.others ?? []) addPerson(other, groupLabel)
                }
                recipients = Array.from(map.values())
              }
            } else {
              // Static demo ECOs
              recipients = notificationRecipientsFor(eco).map((r: any) => ({ ...r, checked: true }))
              for (const name of extraNames) {
                if (!recipients.find((r) => r.name === name)) {
                  recipients.push({ name, reason: 'Manually added', notifyOn: 'Every status change', checked: true })
                }
              }
            }

            return (
              <div className="stack">
                <div className="bet">
                  <div>
                    <h3 data-test-id="notifications-heading">{`${recipients.length} user${recipients.length === 1 ? '' : 's'} will be notified of status changes`}</h3>
                    <div className="sub" style={{ marginTop: 2 }}>Employees and partners are notified on status change. Suppliers are notified only when the change completes.</div>
                  </div>
                  {backendCo && (
                    <button className="btn sm" data-test-id="notifications-add-btn" onClick={() => setNotifyModalOpen(true)}>
                      <Plus size={12} />Add
                    </button>
                  )}
                </div>
                <div className="card" style={{ overflow: "hidden" }}>
                  <table className="tbl" data-test-id="notifications-table">
                    <thead><tr><th style={{ width: 26 }}></th><th>#</th><th>Name</th><th>Reason for notification</th><th>Notify on</th></tr></thead>
                    <tbody>
                      {recipients.map((r, k) => (
                        <tr key={r.name} data-test-id={`notification-row-${k}`}>
                          <td><input type="checkbox" defaultChecked={r.checked} data-test-id={`notification-check-${k}`} /></td>
                          <td>{k + 1}</td>
                          <td className="lnk">{r.name}</td>
                          <td className="sub">{r.reason}</td>
                          <td><Chip k="gray">{r.notifyOn}</Chip></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mini">Showing {recipients.length} of {recipients.length}</div>
              </div>
            );
          })()}

          {tab === "History" && (() => {
            // Build the history rows from available data sources:
            //   1. Persisted historyJson (for COs that had it saved successfully)
            //   2. Synthesised from schema-registered fields (creator, created, routing,
            //      plus any decided approvals) — this always works even when historyJson
            //      is empty because the field isn't in the backend schema yet.
            //   3. Static derived list for demo ECOs without a backend record.
            let historyRows: CoHistoryEntry[]
            if (backendCo) {
              const stored = backendCo.history ?? []
              if (stored.length > 0) {
                // Trust the persisted audit trail
                historyRows = stored
              } else {
                // Synthesise from structured fields always present on the record
                const synthesised: CoHistoryEntry[] = []

                // Creation entry — always first
                synthesised.push({
                  id: 'synth-created',
                  timestamp: (() => {
                    // created is MM/DD/YYYY — convert to a sortable ISO string (start of day)
                    const parts = (backendCo.created ?? '').split('/')
                    if (parts.length === 3) {
                      const [m, d, y] = parts
                      return new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T00:00:00`).toISOString()
                    }
                    return new Date().toISOString()
                  })(),
                  who: backendCo.creator ?? 'Unknown',
                  action: `Change order created and submitted to ${backendCo.routing ?? 'approval'} — ${backendCo.approvals?.length ?? 0} approver role${(backendCo.approvals?.length ?? 0) !== 1 ? 's' : ''} notified`,
                })

                // One entry per completed (non-pending) approval
                for (const a of (backendCo.approvals ?? [])) {
                  if (a.status === 'pending') continue
                  const label =
                    a.status === 'approved' ? 'Approved' :
                    a.status === 'rejected' ? 'Rejected' :
                    a.status === 'comments' ? 'Commented' : a.status
                  synthesised.push({
                    id: `synth-approval-${a.role}`,
                    timestamp: (() => {
                      if (!a.signedAt) return new Date().toISOString()
                      // signedAt format: MM/DD/YYYY HH:MM AM/PM
                      try { return new Date(a.signedAt).toISOString() } catch { return new Date().toISOString() }
                    })(),
                    who: a.approver,
                    action: `${label} — Stage ${a.stage}, ${a.role}${a.comment ? `: "${a.comment}"` : ''}`,
                  })
                }

                historyRows = synthesised
              }
            } else {
              historyRows = HISTORY.map((h: any, k: number) => ({
                id: `static-${k}`,
                timestamp: new Date().toISOString(),
                who: h.w,
                action: h.a,
              }))
            }
            return (
              <div className="card" style={{ overflow: "hidden" }}>
                <table className="tbl">
                  <thead><tr><th style={{ width: 190 }}>When</th><th style={{ width: 180 }}>Who</th><th>Activity</th></tr></thead>
                  <tbody>
                    {historyRows.length === 0 && (
                      <tr><td colSpan={3} className="sub" style={{ textAlign: 'center', padding: '24px 0' }}>No history recorded yet.</td></tr>
                    )}
                    {[...historyRows].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((h) => (
                      <tr key={h.id} data-test-id={`history-row-${h.id}`}>
                        <td className="sub">{new Date(h.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                        <td style={{ fontWeight: 600 }}>{h.who}</td>
                        <td>{h.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })()}
        </div>
      </Card>
      {modal === "share" && (
        <Modal title="Share this change with suppliers" wide onClose={() => setModal(null)}
          foot={<><button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn pri" style={{ marginLeft: "auto" }} disabled={!shareDraft.length}
              onClick={() => { setShared(shareDraft); setModal(null); }}>
              <Check size={13} />Share with {shareDraft.length || ""} supplier{shareDraft.length === 1 ? "" : "s"}</button></>}>
          <SupplierShare pns={["1003140-01", "1002260-01", "1002261-01", "1005393-01", "1006394-01", "2505-0103", "9060-1319"]}
            value={shareDraft} onChange={setShareDraft} />
        </Modal>
      )}

      {modal === "cancelEco" && (
        <Modal title="Cancel this change" onClose={() => setModal(null)}
          foot={<><button className="btn" onClick={() => setModal(null)}>Keep it open</button>
            <button className="btn dan" style={{ marginLeft: "auto" }} onClick={() => setModal(null)}>
              <Ban size={13} />Cancel change</button></>}>
          <div className="warnbox" style={{ marginBottom: 12 }}>Cancelling stops routing and releases every item on this change.
            The record stays in history and cannot be reopened.</div>
          <Field label="Reason"><Select options={["Superseded by another change", "Raised in error", "No longer required",
            "Merged into another change", "Other"]} /></Field>
          <div style={{ height: 12 }} />
          <Field label="Notes"><textarea className="inp" rows={3} /></Field>
        </Modal>
      )}
      {modal === "approve" && (
        <Modal title="Approve this change" onClose={() => { setModal(null); setDcApproveComment('') }}
          foot={<><button className="btn" onClick={() => { setModal(null); setDcApproveComment('') }}>Cancel</button>
            <button
              className="btn ok"
              style={{ marginLeft: "auto" }}
              onClick={handleDcApprove}
              disabled={isDcApproving}
              data-test-id="dc-approve-confirm-btn"
            >
              {isDcApproving ? <><Loader2 size={13} className="spin" />Approving…</> : <><Check size={13} />Approve</>}
            </button></>}>
          <Field label="Comments (optional)">
            <textarea
              className="inp"
              rows={3}
              placeholder="Anything the next approver or document control should know"
              value={dcApproveComment}
              onChange={(e) => setDcApproveComment(e.target.value)}
              data-test-id="dc-approve-comment-input"
            />
          </Field>
          <div className="note" style={{ marginTop: 12 }}>
            Approving will mark remaining pending roles complete and advance to <b>Effective</b> when all required stages are done.
          </div>
        </Modal>
      )}
      {modal === "reject" && (
        <Modal title="Reject this change" onClose={() => { setModal(null); setDcRejectReason(''); setDcRejectNotes(''); }}
          foot={<>
            <button className="btn" onClick={() => { setModal(null); setDcRejectReason(''); setDcRejectNotes(''); }}>Cancel</button>
            <button
              className="btn dan"
              style={{ marginLeft: "auto" }}
              disabled={!dcRejectReason.trim() || isDcRejecting}
              onClick={handleDcReject}
              data-test-id="dc-reject-confirm-btn"
            >
              {isDcRejecting ? <><Loader2 size={13} className="spin" />Rejecting…</> : <><X size={13} />Reject and stop routing</>}
            </button>
          </>}>
          <div className="warnbox" style={{ marginBottom: 12 }}>Rejecting stops routing for everyone. Document control will withdraw the change to Open to rework it.</div>
          <Field label="Reason">
            <Select
              value={dcRejectReason}
              onChange={(e: any) => setDcRejectReason(e.target.value)}
              options={["", "Redline does not match the description", "Drawing or file incorrect", "Missing tolerance or evidence",
                "Wrong supplier selected", "Item should not be on this change", "Other"]}
              data-test-id="dc-reject-reason-select"
            />
          </Field>
          <div style={{ height: 12 }} />
          <Field label="Notes for document control" hint="These notes go into the rejection email and sit under Decisions.">
            <textarea
              className="inp"
              rows={4}
              value={dcRejectNotes}
              onChange={(e) => setDcRejectNotes(e.target.value)}
              data-test-id="dc-reject-notes-input"
            /></Field>
        </Modal>
      )}
      {modal === "withdraw" && (
        <Modal title="Withdraw to Open" onClose={() => setModal(null)}
          foot={<><button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button
              className="btn pri"
              style={{ marginLeft: "auto" }}
              onClick={handleWithdraw}
              disabled={isWithdrawing}
              data-test-id="withdraw-confirm-btn"
            >
              {isWithdrawing ? <><Loader2 size={13} className="spin" />Withdrawing…</> : <><CornerUpLeft size={13} />Withdraw</>}
            </button></>}>
          <p className="sub" style={{ marginTop: 0 }}>Items and redlines can only be edited while a change is Open. Withdrawing returns it to the requester
            and document control for rework. Prior decisions are recorded in History.</p>
          <Field label="Who picks this up?">
            <Select options={["Document control can resolve it (administrative)", `Return to requester — ${eco.creator} (engineering)`, "Both"]} /></Field>
          <div style={{ height: 12 }} />
          <label className="row"><input type="checkbox" defaultChecked /> Email the requester with the rejection notes</label>
        </Modal>
      )}
      {modal === "complete" && (
        <Modal title="Verify SAP write-back" onClose={() => setModal(null)} wide
          foot={<><button className="btn" onClick={() => setModal(null)}>Close</button>
            <button
              className="btn pri"
              style={{ marginLeft: "auto" }}
              onClick={handleComplete}
              disabled={!syncing || isCompleting}
              data-test-id="complete-confirm-btn"
            >
              {isCompleting ? <><Loader2 size={13} className="spin" />Completing…</> : <><CheckCircle2 size={13} />Move to Complete</>}
            </button></>}>
          <div className="bet" style={{ marginBottom: 12 }}>
            <div className="row"><Database size={15} color={T.brand} /><b>SAP ECC · plant 1210</b></div>
            <button className="btn sm" onClick={() => setSyncing(true)}><RefreshCw size={12} />Re-check now</button>
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            <table className="tbl">
              <thead><tr><th>Item</th><th>Field</th><th>Topcon PLM</th><th>SAP</th><th>Status</th></tr></thead>
              <tbody>
                {[["1007886-02", "Material status", "20 – ACTIVE", "20 – ACTIVE"],
                  ["1007886-02", "BOM component qty", "4 EA", "4 EA"],
                  ["1002260-01", "Material status", "20 – ACTIVE", "20 – ACTIVE"],
                  ["9060-1319", "BOM usage", "Removed", syncing ? "Removed" : "Pending"]].map((r: any, k: any) => (
                  <tr key={k}><td className="pn">{r[0]}</td><td className="sub">{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td>
                    <td>{r[3] === "Pending" ? <Chip k="warn">Waiting</Chip> : <Chip k="ok">Matched</Chip>}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="note" style={{ marginTop: 12 }}>
            {syncing ? "All fields matched. The change can be moved to Complete."
              : "One field is still transferring. Re-check in a few minutes — transfer usually takes 15 to 30 minutes."}
          </div>
        </Modal>
      )}
      {modal === "analysis" && (() => {
        const isECO010870 = eco.id === "ECO-010870";
        const rows = isECO010870
          ? [
              [true, "Obsolescence verification", "No TPS open demand found in last 90 days across all 129 items."],
              [true, "Status transition", "All 129 items transition from In Production to Status 50 (Discontinued/Inactive)."],
              [true, "Where used cascade", "Unique child components correctly scoped into this change; no parent outside the change is broken."],
              [true, "Compliance & files", "Inactivation change order — drawing updates not required. Obsolescence notice attached."],
              [false, "Downstream service impact", "Three service spare kits inherit discontinued status — verify no open warranty commitments."],
              [true, "Duplicate changes", "No conflicting open changes found on these part numbers."],
            ]
          : [
              [true, "Redline matches the description", "Description lists 2 additions and 1 deletion. Redline shows exactly those three lines."],
              [true, "Revision roll is correct", "Rev B → C. Last production revision was B, no open revisions elsewhere."],
              [true, "Compliance", "All BOM children are RoHS compliant, so the top level is compliant. No certificate required."],
              [false, "Where used", "1003140-01 appears in 3 sales kits. Two of them still reference the removed tape 9060-1319 in their assembly instructions."],
              [true, "Sourcing and files", "Sales BOM — no drawings or sourcing records expected."],
              [false, "Cost", "Net component cost rises 1.8%. Description states no list price update is required — confirm with product management."],
              [true, "Duplicate changes", "No other open change touches these items."],
            ];

        return (
          <Modal title={`Pre-approval analysis — ${eco.id}`} onClose={() => setModal(null)} wide
            foot={<><Chip k="vio">Advisory — approvers decide</Chip>
              <button className="btn pri" style={{ marginLeft: "auto" }} onClick={() => setModal(null)}>Attach to change</button></>}>
            <div className="card" style={{ overflow: "hidden" }}>
              <table className="tbl">
                <thead><tr><th style={{ width: 26 }}></th><th>Check</th><th>Finding</th></tr></thead>
                <tbody>
                  {rows.map(([ok, t, d]: any, k: any) => (
                    <tr key={k}><td>{ok ? <Check size={13} color={T.ok} /> : <AlertTriangle size={13} color={T.warn} />}</td>
                      <td style={{ fontWeight: 600 }}>{t}</td><td className="sub">{d}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="warnbox" style={{ marginTop: 12 }}>
              {isECO010870
                ? "One item needs a human: confirm service spare kits have no pending warranty back-orders. All other checks passed."
                : "Two items need a human: the downstream work instructions and the cost note. Everything else is verified."}
            </div>
          </Modal>
        );
      })()}
      {/* Approver reject reason modal */}
      {rejectModal && (
        <Modal
          title="Reject this change"
          onClose={() => { setRejectModal(false); setRejectReason(''); }}
          foot={
            <>
              <button className="btn" onClick={() => { setRejectModal(false); setRejectReason(''); }}>Cancel</button>
              <button
                className="btn dan"
                style={{ marginLeft: "auto" }}
                disabled={!rejectReason.trim() || isRejecting}
                onClick={handleReject}
                data-test-id="approver-reject-confirm-btn"
              >
                {isRejecting ? <><Loader2 size={13} className="spin" />Rejecting…</> : <><X size={13} />Submit rejection</>}
              </button>
            </>
          }
        >
          <div className="warnbox" style={{ marginBottom: 14 }}>
            Your rejection will be sent to Document Control. They will review your notes and determine next steps.
          </div>
          <Field label="Reason for rejection">
            <Select
              value={rejectReason}
              onChange={(e: any) => setRejectReason(e.target.value)}
              options={[
                "",
                "Redline does not match the description",
                "Drawing or file incorrect",
                "Missing tolerance or evidence",
                "Wrong supplier selected",
                "Item should not be on this change",
                "Impact not fully assessed",
                "Requires further review",
                "Other",
              ]}
              data-test-id="approver-reject-reason-select"
            />
          </Field>
          <div style={{ height: 12 }} />
          <Field label="Additional notes (optional)" hint="These notes go to Document Control and appear under Decisions.">
            <textarea
              className="inp"
              rows={4}
              placeholder="Explain why you are rejecting — what needs to change before you can approve…"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              data-test-id="approver-reject-notes-input"
            />
          </Field>
        </Modal>
      )}
      {/* ── Add Notification Recipient Modal ── */}
      {notifyModalOpen && (() => {
        const existingNames = new Set((eco as any).extraNotifyNames ?? [])
        const query = notifySearch.toLowerCase()
        const filtered = (allUsers ?? []).filter((u) =>
          u.active && (u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query) || u.group.toLowerCase().includes(query))
        )
        return (
          <Modal
            title="Add notification recipient"
            onClose={() => { setNotifyModalOpen(false); setNotifySearch('') }}
            foot={<button className="btn" onClick={() => { setNotifyModalOpen(false); setNotifySearch('') }}>Close</button>}
            data-test-id="notify-add-modal"
          >
            <input
              className="inp"
              placeholder="Search by name, email or group…"
              value={notifySearch}
              onChange={(e) => setNotifySearch(e.target.value)}
              autoFocus
              data-test-id="notify-search-input"
            />
            <div style={{ marginTop: 12, maxHeight: 340, overflowY: 'auto' }}>
              {filtered.length === 0 && (
                <div className="sub" style={{ textAlign: 'center', padding: '24px 0' }}>No users match your search.</div>
              )}
              {filtered.map((u) => {
                const already = existingNames.has(u.name)
                return (
                  <div
                    key={u.id}
                    className="row"
                    style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)', alignItems: 'center', justifyContent: 'space-between' }}
                    data-test-id={`notify-user-row-${u.id}`}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      <div className="sub" style={{ marginTop: 2 }}>{u.group} · {u.email}</div>
                    </div>
                    <button
                      className="btn sm ok"
                      disabled={already || isSavingNotify}
                      onClick={() => handleAddNotifyUser(u.name)}
                      data-test-id={`notify-user-add-${u.id}`}
                    >
                      {already ? 'Added' : <><Plus size={11} />Add</>}
                    </button>
                  </div>
                )
              })}
            </div>
          </Modal>
        )
      })()}

      {/* ── Comment Drawer ── */}
      {commentDrawerOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(0,0,0,0.35)' }}
            onClick={() => setCommentDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
              width: 420, background: T.g25, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
              display: 'flex', flexDirection: 'column',
            }}
            data-test-id="comment-drawer"
            aria-label="Add comment"
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 16px', borderBottom: `1px solid ${T.g200}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={16} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>Add A Comment</span>
              </div>
              <button className="btn gh sm" onClick={() => setCommentDrawerOpen(false)} aria-label="Close" data-test-id="comment-drawer-close">
                <X size={14} />
              </button>
            </div>

            {/* Past comments trail */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }} data-test-id="comment-thread">
              {commentsLoading && allComments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: T.g400, fontSize: 13 }} data-test-id="comment-loading-state">
                  Loading comments…
                </div>
              ) : allComments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: T.g400, fontSize: 13 }} data-test-id="comment-empty-state">
                  No comments yet — be the first to leave a note.
                </div>
              ) : (
                allComments.map((c) => (
                  <div key={c.id} style={{ padding: '12px 14px', background: T.g50, borderRadius: 8, border: `1px solid ${T.g200}` }} data-test-id={`comment-item-${c.id}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.b100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: T.brand, flexShrink: 0 }}>
                        {initials(c.author)}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>{c.author}</span>
                        <span style={{ fontSize: 11, color: T.g400, lineHeight: 1.2 }}>{formatCommentTime(c.timestamp)}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', paddingLeft: 36 }}>{c.message}</div>
                  </div>
                ))
              )}
            </div>

            {/* Input area */}
            <div style={{ borderTop: `1px solid ${T.g200}`, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }} data-test-id="comment-input-area">
              {/* Posting as — read-only, derived from logged-in user */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: T.g50, borderRadius: 6, border: `1px solid ${T.g200}` }} data-test-id="comment-posting-as">
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: T.b100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: T.brand, flexShrink: 0 }}>
                  {initials(commentAuthor)}
                </div>
                <span style={{ fontSize: 12, color: T.g500 }}>Posting as </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.g800 }}>{commentAuthor}</span>
              </div>
              <Field label="Comment">
                <textarea
                  className="inp"
                  rows={4}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={`Leave a note on ${eco.id}…`}
                  data-test-id="comment-text-input"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveComment()
                  }}
                />
              </Field>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => setCommentDrawerOpen(false)} data-test-id="comment-cancel-btn">Cancel</button>
                <button
                  className="btn pri"
                  disabled={!commentText.trim() || isSavingComment}
                  onClick={handleSaveComment}
                  data-test-id="comment-save-btn"
                >
                  {isSavingComment ? <><Loader2 size={13} className="spin" />Saving…</> : <><Send size={13} />Post Comment</>}
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

export { EcoDetail }


