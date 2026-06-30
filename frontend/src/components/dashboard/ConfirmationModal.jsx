import React from "react";
import { createPortal } from "react-dom"; // <--- 1. IMPORT THIS
import {
  FaTimes,
  FaExclamationTriangle,
  FaCheckCircle,
  FaInfoCircle,
} from "react-icons/fa";

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  type = "default",
  confirmText = "Confirm",
  cancelText = "Cancel",
  children,
}) => {
  if (!isOpen) return null;

  const getModalStyles = () => {
    switch (type) {
      case "warning":
        return {
          icon: <FaExclamationTriangle className="text-amber-500 text-2xl" />,
          headerBg: "bg-amber-50",
          btnBg: "bg-amber-500 hover:bg-amber-600 focus:ring-amber-200",
          titleColor: "text-amber-800",
        };
      case "danger":
        return {
          icon: <FaExclamationTriangle className="text-red-500 text-2xl" />,
          headerBg: "bg-red-50",
          btnBg: "bg-red-600 hover:bg-red-700 focus:ring-red-200",
          titleColor: "text-red-800",
        };
      default:
        return {
          icon: <FaInfoCircle className="text-emerald-500 text-2xl" />,
          headerBg: "bg-gray-50",
          btnBg: "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-200",
          titleColor: "text-gray-800",
        };
    }
  };

  const styles = getModalStyles();

  // 2. WRAP EVERYTHING IN createPortal(..., document.body)
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop - Added backdrop-blur-sm for glass effect */}
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
          aria-hidden="true"
          onClick={onClose}
        ></div>

        {/* Centering Trick */}
        <span
          className="hidden sm:inline-block sm:align-middle sm:h-screen"
          aria-hidden="true"
        >
          &#8203;
        </span>

        {/* Modal Panel - Added z-50 relative to ensure it sits on backdrop */}
        <div className="relative z-50 inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full scale-100 opacity-100">
          {/* Header */}
          <div
            className={`${styles.headerBg} px-6 py-4 flex items-center justify-between border-b border-gray-100`}
          >
            <div className="flex items-center gap-3">
              {styles.icon}
              <h3
                className={`text-lg leading-6 font-bold ${styles.titleColor}`}
                id="modal-title"
              >
                {title}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-black/5"
            >
              <FaTimes className="text-lg" />
            </button>
          </div>

          {/* Content */}
          <div className="bg-white px-6 py-6">
            <div className="mt-2">
              <p className="text-sm text-gray-500 mb-4 font-medium leading-relaxed">
                {message}
              </p>
              {children}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-gray-50 px-6 py-4 flex flex-row-reverse gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onConfirm}
              className={`w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-5 py-2.5 text-base font-bold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm transition-all ${styles.btnBg}`}
            >
              {confirmText}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-xl border border-gray-300 shadow-sm px-5 py-2.5 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-all"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body, // <--- This attaches it to the <body>, breaking it out of the dashboard layout
  );
};

export default ConfirmationModal;
