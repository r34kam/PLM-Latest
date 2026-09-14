import { X } from 'lucide-react'

const Modal = ({ title, onClose, children, foot, wide }: any) =>
  <div className="modalbg" data-test-id="modal-backdrop" onClick={onClose}>
    <div className="modal" data-test-id="modal-container" style={wide ? { maxWidth: 880 } : undefined} onClick={(e: any) => e.stopPropagation()}>
      <div className="modalhead">
        <h2>{title}</h2>
        <button className="btn gh sm" onClick={onClose}><X size={14} /></button>
      </div>
      <div className="modalbody">{children}</div>
      {foot && <div className="modalfoot row">{foot}</div>}
    </div>
  </div>;

export { Modal }


