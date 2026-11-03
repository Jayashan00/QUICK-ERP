import toast, { type ToastOptions } from 'react-hot-toast';

const ids = {
  success: (message: string) => `success:${message}`,
  error: (message: string) => `error:${message}`,
  info: (message: string) => `info:${message}`,
  warning: (message: string) => `warning:${message}`,
  loading: (message: string) => `loading:${message}`,
};

const warningOptions: ToastOptions = {
  icon: '\u26A0',
  style: {
    borderColor: '#fcd34d',
    background: '#fffbeb',
    color: '#92400e',
  },
};

const infoOptions: ToastOptions = {
  icon: '\u2139',
  style: {
    borderColor: '#7dd3fc',
    background: '#f0f9ff',
    color: '#075985',
  },
};

export const appToast = {
  success(message: string) {
    return toast.success(message, { id: ids.success(message) });
  },
  error(message: string) {
    return toast.error(message, { id: ids.error(message) });
  },
  info(message: string) {
    return toast(message, { ...infoOptions, id: ids.info(message) });
  },
  warning(message: string) {
    return toast(message, { ...warningOptions, id: ids.warning(message) });
  },
  loading(message: string) {
    return toast.loading(message, { id: ids.loading(message) });
  },
  dismiss(id?: string) {
    toast.dismiss(id);
  },
};
