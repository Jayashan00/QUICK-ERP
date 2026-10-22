import toast from 'react-hot-toast';

export const appToast = {
  success(message: string) {
    return toast.success(message, { id: `success:${message}` });
  },
  error(message: string) {
    return toast.error(message, { id: `error:${message}` });
  },
  info(message: string) {
    return toast(message, { id: `info:${message}`, icon: 'ℹ️' });
  },
  warning(message: string) {
    return toast(message, { id: `warning:${message}`, icon: '⚠️' });
  },
  loading(message: string) {
    return toast.loading(message, { id: `loading:${message}` });
  },
  dismiss(id?: string) {
    toast.dismiss(id);
  },
};
