import React from "react";

export default function Input({
  label,
  hint,
  error,
  id,
  as = "input",
  className = "",
  inputClassName = "",
  required = false,
  ...props
}) {
  const generatedId = id || React.useId();
  const Component = as;
  const describedBy = [hint ? `${generatedId}-hint` : null, error ? `${generatedId}-error` : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <label className={`block space-y-2 ${className}`} htmlFor={generatedId}>
      {label && <span className="text-sm font-medium text-text">{label}{required ? <span className="ml-1 text-danger">*</span> : null}</span>}
      <Component
        id={generatedId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        required={required}
        className={`input ${inputClassName} ${error ? "border-danger focus:ring-danger/50 focus-visible:border-danger" : ""}`}
        {...props}
      />
      {hint && !error && (
        <p id={`${generatedId}-hint`} className="text-xs text-text/60">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${generatedId}-error`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </label>
  );
}