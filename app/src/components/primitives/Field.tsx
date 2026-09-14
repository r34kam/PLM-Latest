
const Field = ({ label, children, hint }: { label: any; children: any; hint?: any }) => (
  <div data-test-id="form-field">
    <label className="fl">{label}</label>
    {children}
    {hint && <div className="mini" style={{ marginTop: 4 }}>{hint}</div>}
  </div>
);
const Input = (p: any) => <input className="inp" data-test-id="text-input" {...p} />;
const Select = ({ options = [], ...p }: { options?: string[] } & any) => (
  <select className="inp" data-test-id="select-input" {...p}>{options.map((o: any) => <option key={o}>{o}</option>)}</select>
);

export { Field, Input, Select }


