/**
 * DocSpaceEditor — inline editor for creating / editing a doc space.
 *
 * Migrated from monolith (packages/web/src/apps/settings/admin/DocSpaceEditor.tsx).
 * Uses @tokimo/ui for Form/Modal/ScrollArea/TextArea/Button/AvatarPicker,
 * and the docs app's own API client for mutations.
 */

import { useQueryClient } from "@tanstack/react-query";
import {
  AvatarPicker,
  Button,
  Form,
  type FormInstance,
  Modal,
  parseAvatar,
  ScrollArea,
  StorageBindingsField,
  TextArea,
  type AvatarData,
  useToast as useMessage,
} from "@tokimo/ui";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/generated";

interface DocSpaceEditorProps {
  spaceId?: string;
  onSaved?: (savedId: string) => void;
  onDeleted?: () => void;
  onCancel?: () => void;
}

export default function DocSpaceEditor({
  spaceId,
  onSaved,
  onDeleted,
  onCancel,
}: DocSpaceEditorProps) {
  const { t } = useTranslation();
  const message = useMessage();
  const qc = useQueryClient();
  const [form] = Form.useForm();

  const { data: spaces = [] } = api.docs.listSpaces.useQuery({});
  const { data: vfsSources = [] } = api.vfs.list.useQuery();
  const space = spaceId ? spaces.find((s) => s.id === spaceId) : undefined;
  const isEdit = !!space;

  const [avatar, setAvatar] = useState<AvatarData | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const prevId = useRef(spaceId);
  useEffect(() => {
    if (prevId.current !== spaceId) {
      prevId.current = spaceId;
      setDeleteOpen(false);
    }
  }, [spaceId]);

  useEffect(() => {
    if (space) {
      form.setFieldsValue({
        name: space.name,
        description: space.description ?? "",
      });
      setAvatar(parseAvatar(space.avatar));
    } else {
      form.resetFields();
      setAvatar(null);
    }
  }, [space, form]);

  const initialBindings = space?.vfsId
    ? [
        {
          sourceId: space.vfsId,
          rootPath: space.rootPath ?? "",
          isDefaultDownload: true,
        },
      ]
    : undefined;

  const createMut = api.docs.createSpace.useMutation();
  const updateMut = api.docs.updateSpace.useMutation();
  const deleteMut = api.docs.deleteSpace.useMutation();

  const handleSave = async () => {
    const values = (await form.validateFields()) as {
      name: string;
      description?: string;
    };
    const rawBindings =
      (form.getFieldValue("bindings") as Array<{ sourceId: string; rootPath: string }> | undefined) ?? [];
    const binding = rawBindings.find((b) => b.sourceId);
    if (!binding) {
      message.error("请选择 VFS 存储源");
      return;
    }
    const vfsId = binding.sourceId;
    const rootPath = binding.rootPath?.trim() || undefined;

    try {
      let savedId: string;
      if (isEdit) {
        await updateMut.mutateAsync({
          id: space.id,
          name: values.name,
          description: values.description,
          vfsId,
          rootPath,
          avatar: avatar as Record<string, unknown> | null,
        });
        savedId = space.id;
        message.success("已更新");
      } else {
        const created = await createMut.mutateAsync({
          name: values.name,
          description: values.description,
          vfsId,
          rootPath,
          avatar: avatar as Record<string, unknown> | null,
        });
        savedId = created.id;
        message.success("已创建");
      }
      qc.invalidateQueries({ queryKey: ["/api/apps/docs/spaces"] });
      onSaved?.(savedId);
    } catch {
      message.error(isEdit ? "更新失败" : "创建失败");
    }
  };

  const handleDelete = async () => {
    if (!space) return;
    try {
      await deleteMut.mutateAsync({ id: space.id });
      qc.invalidateQueries({ queryKey: ["/api/apps/docs/spaces"] });
      message.success("已删除");
      onDeleted?.();
    } catch {
      message.error("删除失败");
    }
    setDeleteOpen(false);
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Form
        form={form as FormInstance}
        layout="vertical"
        autoComplete="off"
        className="flex min-h-0 flex-1 flex-col"
      >
        <ScrollArea
          className="min-h-0 flex-1"
          innerClassName="space-y-5 px-5 py-5"
        >
          <div className="rounded-lg border border-border-base p-5">
            <h4 className="mb-4 text-sm font-semibold text-fg-primary">
              基本信息
            </h4>

            <div className="mb-5">
              <AvatarPicker value={avatar} onChange={setAvatar} size={80} />
            </div>

            <Form.Item
              name="name"
              label="名称"
              rules={[{ required: true, message: "请输入文档空间名称" }]}
            >
              <input
                className="h-10 w-full rounded-md border border-border-base bg-bg-base px-3 text-sm text-fg-primary outline-none transition-colors placeholder:text-fg-muted focus:border-brand"
                placeholder="文档空间名称"
              />
            </Form.Item>

            <Form.Item name="description" label="描述" className="!mb-0">
              <TextArea placeholder="可选描述" rows={3} />
            </Form.Item>
          </div>

          <div className="rounded-lg border border-border-base p-5">
            <h4 className="mb-4 text-sm font-semibold text-fg-primary">
              路径配置
            </h4>
            <StorageBindingsField
              sources={vfsSources as import("@tokimo/ui").VfsDto[]}
              form={form}
              initialSources={initialBindings}
              maxBindings={1}
            />
          </div>
        </ScrollArea>

        <div className="flex shrink-0 items-center justify-between border-t border-border-base px-5 py-3">
          <div>
            {isEdit && (
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 size={14} className="mr-1" />
                删除
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="default" onClick={onCancel}>
              取消
            </Button>
            <Button loading={isPending} onClick={() => void handleSave()}>
              {isEdit ? "保存" : "创建"}
            </Button>
          </div>
        </div>
      </Form>

      <Modal
        open={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        title="删除文档空间"
        size="form"
      >
        <div className="space-y-4 p-4">
          <p className="text-sm text-fg-secondary">
            确定删除「{space?.name}
            」？该操作会同时删除空间下的所有文档节点，且不可恢复。
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="default" onClick={() => setDeleteOpen(false)}>
              取消
            </Button>
            <Button
              variant="danger"
              loading={deleteMut.isPending}
              onClick={handleDelete}
            >
              确认删除
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
