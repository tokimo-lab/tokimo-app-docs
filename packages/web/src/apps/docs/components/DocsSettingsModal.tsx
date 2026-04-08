import { Modal, Spin } from "@tokiomo/components";
import { lazy, Suspense } from "react";

const DocsSettingsPage = lazy(
  () => import("@/apps/settings/admin/DocsSettingsPage"),
);

interface DocsSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function DocsSettingsModal({
  open,
  onClose,
}: DocsSettingsModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="TokimoDocs 设置"
      footer={null}
      width={800}
      destroyOnClose
      styles={{ body: { padding: 0 } }}
    >
      <div className="h-[560px]">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <Spin />
            </div>
          }
        >
          <DocsSettingsPage />
        </Suspense>
      </div>
    </Modal>
  );
}
