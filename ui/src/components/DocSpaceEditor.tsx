/**
 * DocSpaceEditor — inline editor for creating / editing a doc space.
 *
 * Follows the same pattern as VideoLibraryEditor in tokimo-app-video.
 */

import { useQueryClient } from "@tanstack/react-query";
import {
  AvatarPicker,
  Button,
  Form,
  type FormInstance,
  Input,
  Modal,
  parseAvatar,
  ScrollArea,
  StorageBindingsField,
  type AvatarData,
  useToast as useMessage,
} from "@tokimo/ui";
import { useRuntimeCtx } from "@tokimo/sdk";
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
  const ctx = useRuntimeCtx();

  const { data: spaces = [] } = api.docs.listSpaces.useQuery({});
  const { data: vfsSources = [] } = api.vfs.list.useQuery();
  const space = spaceId ? spaces.find((s) => s.id === spaceId) : undefined;
  const isEdit = !!space;

  const [avatar, setAvatar] = useState<AvatarData | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  const prevId = useRef(spaceId);
  useEffect(() => {
    if (prevId.current !== spaceId) {
      prevId.current = spaceId;
      setDeleteOpen(false);
      setDeleteInput("");
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
    const vfsId = binding?.sourceId || undefined;
    const rootPath = binding?.rootPath?.trim() || undefined;

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
        message.success(t("spaceEditor.updateSuccess", "已更新"));
      } else {
        const created = await createMut.mutateAsync({
          name: values.name,
          description: values.description,
          vfsId,
          rootPath,
          avatar: avatar as Record<string, unknown> | null,
        });
        savedId = created.id;
        message.success(t("spaceEditor.createSuccess", "已创建"));
      }
      qc.invalidateQueries({ queryKey: ["/api/apps/docs/spaces"] });
      onSaved?.(savedId);
    } catch {
      message.error(
        isEdit
          ? t("spaceEditor.updateFailed", "更新失败")
          : t("spaceEditor.createFailed", "创建失败"),
      );
    }
  };

  const handleDelete = async () => {
    if (!space) return;
    try {
      await deleteMut.mutateAsync({ id: space.id });
      qc.invalidateQueries({ queryKey: ["/api/apps/docs/spaces"] });
      message.success(t("spaceEditor.deleteSuccess", "已删除"));
      onDeleted?.();
    } catch {
      message.error(t("spaceEditor.deleteFailed", "删除失败"));
    }
    setDeleteOpen(false);
    setDeleteInput("");
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
          direction="vertical"
          className="min-h-0 flex-1"
          innerClassName="space-y-5 px-5 py-5"
        >
          {/* 基本信息 */}
          <div className="rounded-lg border border-border-base p-5">
            <h4 className="mb-4 text-sm font-semibold text-fg-primary">
              {t("spaceEditor.basicInfo", "基本信息")}
            </h4>

            <div className="mb-5">
              <AvatarPicker value={avatar} onChange={setAvatar} size={80} />
            </div>

            <Form.Item
              name="name"
              label={t("spaceEditor.name", "名称")}
              rules={[
                {
                  required: true,
                  message: t("spaceEditor.nameRequired", "请输入文档空间名称"),
                },
              ]}
            >
              <Input
                placeholder={t("spaceEditor.namePlaceholder", "文档空间名称")}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="description"
              label={t("spaceEditor.description", "描述")}
              className="!mb-0"
            >
              <Input.TextArea
                placeholder={t(
                  "spaceEditor.descriptionPlaceholder",
                  "可选描述",
                )}
                rows={3}
              />
            </Form.Item>
          </div>

          {/* 路径配置 */}
          <div className="rounded-lg border border-border-base p-5">
            <h4 className="mb-4 text-sm font-semibold text-fg-primary">
              {t("spaceEditor.pathConfig", "路径配置")}
            </h4>
            <StorageBindingsField
              form={form}
              sources={vfsSources as import("@tokimo/ui").VfsDto[]}
              initialSources={initialBindings}
              minBindings={1}
              maxBindings={1}
              shell={ctx.shell}
            />
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-border-base px-5 py-3">
          <div>
            {isEdit && (
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 size={14} className="mr-1" />
                {t("spaceEditor.delete", "删除")}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="default" onClick={onCancel}>
              {t("spaceEditor.cancel", "取消")}
            </Button>
            <Button loading={isPending} onClick={() => void handleSave()}>
              {isEdit
                ? t("spaceEditor.save", "保存")
                : t("spaceEditor.create", "创建")}
            </Button>
          </div>
        </div>
      </Form>

      {/* Delete confirm with type-to-confirm */}
      {space && (
        <Modal
          open={deleteOpen}
          onCancel={() => {
            setDeleteOpen(false);
            setDeleteInput("");
          }}
          title={t("spaceEditor.deleteTitle", "删除文档空间")}
          footer={null}
        >
          <div className="space-y-4 pt-1">
            <p className="text-sm text-fg-secondary">
              {t(
                "spaceEditor.deleteConfirmPrefix",
                "确定删除「",
              )}{" "}
              <span className="font-semibold text-fg-primary">
                {space.name}
              </span>{" "}
              {t(
                "spaceEditor.deleteConfirmMiddle",
                "」？该操作会同时删除空间下的所有文档节点，且",
              )}
              <span className="font-semibold text-red-500">
                {t("spaceEditor.deleteConfirmIrreversible", "不可恢复")}
              </span>
              {t("spaceEditor.deleteConfirmSuffix", "。")}
            </p>
            <Input
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={space.name}
              onPressEnter={() => {
                if (deleteInput === space.name) void handleDelete();
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="default"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteInput("");
                }}
              >
                {t("spaceEditor.cancel", "取消")}
              </Button>
              <Button
                variant="danger"
                disabled={deleteInput !== space.name}
                loading={deleteMut.isPending}
                onClick={() => void handleDelete()}
              >
                {t("spaceEditor.confirmDelete", "确认删除")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
