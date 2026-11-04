import { useId, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

export default function PasswordField({ label, id, ...input }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  return (
    <div className="ld-field">
      <label htmlFor={inputId}>{label}</label>
      <span className="ld-password ld-password-text-toggle">
        <input {...input} id={inputId} type={visible ? "text" : "password"} />
        <button
          type="button"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
          aria-controls={inputId}
          onClick={() => setVisible(value => !value)}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </span>
    </div>
  );
}
