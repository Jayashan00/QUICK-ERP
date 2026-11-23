import {
  useForm,
  type FieldValues,
  type UseFormProps,
  type UseFormReturn,
} from 'react-hook-form';

/**
 * Standard form hook for QUICK-ERP with user-friendly validation defaults:
 * - `mode: 'onTouched'`: Validates when fields are blurred, and re-validates on every keystroke
 *   once touched, so users see clear guidance as they type invalid data without premature noise.
 * - `reValidateMode: 'onChange'`: Live updates and clears error messages as users correct invalid data.
 */
export function useAppForm<
  TFieldValues extends FieldValues = FieldValues,
  // Same default as react-hook-form's own UseFormProps, so every existing form keeps its types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TContext = any,
  TTransformedValues = TFieldValues,
>(
  props?: UseFormProps<TFieldValues, TContext, TTransformedValues>,
): UseFormReturn<TFieldValues, TContext, TTransformedValues> {
  return useForm<TFieldValues, TContext, TTransformedValues>({
    mode: 'onTouched',
    reValidateMode: 'onChange',
    ...props,
  });
}
