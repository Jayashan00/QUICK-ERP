import type { FormHTMLAttributes, ReactNode } from 'react';

export interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  children: ReactNode;
}

export function Form({ children, noValidate = true, ...props }: FormProps) {
  return (
    <form noValidate={noValidate} {...props}>
      {children}
    </form>
  );
}
