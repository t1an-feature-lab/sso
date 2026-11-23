"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { FieldStatus } from '@astryxdesign/core/Field';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { MAX_IMAGE_SIZE_BYTES } from '@/common/image';
import type { PublicUser } from '@/common/types';
import { useAppToast } from '@/components/app-toast';
import { updateProfileAction } from '@/server/actions';

export function ProfileDialog({ user, isOpen, onOpenChange }: { user: PublicUser; isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const toast = useAppToast();
  const formId = useId();
  const hintId = useId();
  const avatarErrorId = useId();
  const avatarInput = useRef<HTMLInputElement>(null);
  const avatarButton = useRef<HTMLButtonElement>(null);
  const usernameInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const [username, setUsername] = useState(user.username);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function changeOpen(open: boolean) {
    if (!submitting.current) onOpenChange(open);
  }

  function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const error = !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
      ? '请选择 PNG、JPEG 或 WebP 图片'
      : !file.size ? '图片内容不能为空'
        : file.size > MAX_IMAGE_SIZE_BYTES ? '图片大小不能超过 10 MB' : '';
    setErrors((previous) => ({ ...previous, avatar: error }));
    if (error) {
      avatarButton.current?.focus();
      return;
    }
    setAvatar(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (errors.avatar) {
      avatarButton.current?.focus();
      return;
    }
    submitting.current = true;
    setPending(true);
    const data = new FormData(event.currentTarget);
    if (avatar) data.set('avatar', avatar);
    try {
      const result = await updateProfileAction(data);
      if (result.fieldErrors) {
        setErrors(result.fieldErrors);
        if (result.fieldErrors.avatar) avatarButton.current?.focus();
        else usernameInput.current?.focus();
        return;
      }
      if (result.error) {
        toast({ body: result.error, type: 'error' });
        return;
      }
      router.refresh();
      toast({ body: result.success ?? '个人信息已保存' });
      onOpenChange(false);
    } catch {
      toast({ body: '保存失败，请稍后重试', type: 'error' });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={changeOpen} purpose="form" width={520}>
      <Layout
        header={<DialogHeader title="个人信息" onOpenChange={pending ? undefined : changeOpen} />}
        content={<LayoutContent>
          <form id={formId} onSubmit={save} noValidate aria-label="编辑个人信息" aria-busy={pending}>
            <VStack gap={6}>
              <FormLayout>
                <VStack gap={2}>
                  <HStack gap={4} vAlign="center">
                    <Avatar src={previewUrl || user.avatarUrl || undefined} name={username || user.username} size={64} tooltip={false} />
                    <StackItem size="fill">
                      <VStack gap={2} hAlign="start">
                        <Button ref={avatarButton} label="更换头像" size="sm" onClick={() => avatarInput.current?.click()} isDisabled={pending}
                          aria-invalid={Boolean(errors.avatar)} aria-describedby={[hintId, errors.avatar ? avatarErrorId : ''].filter(Boolean).join(' ')} />
                        <Text type="supporting" id={hintId}>PNG / JPG / WebP，≤10 MB</Text>
                      </VStack>
                    </StackItem>
                  </HStack>
                  <input ref={avatarInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={selectAvatar} disabled={pending} hidden />
                  {errors.avatar && <FieldStatus id={avatarErrorId} type="error" message={errors.avatar} variant="detached" />}
                </VStack>
                <TextInput ref={usernameInput} label="用户名" htmlName="username" value={username}
                  onChange={(value) => { setUsername(value); setErrors((previous) => ({ ...previous, username: '' })); }}
                  placeholder="请输入用户名" autoComplete="nickname" autoCapitalize="none" hasAutoCorrect={false} hasSpellCheck={false}
                  {...{ maxLength: 64 }} isRequired isDisabled={pending} width="100%"
                  status={errors.username ? { type: 'error', message: errors.username } : undefined} statusVariant="detached" />
              </FormLayout>
              <MetadataList>
                <MetadataListItem label="手机号">{user.phone ?? '—'}</MetadataListItem>
                <MetadataListItem label="角色"><Badge label={user.role === 'admin' ? '管理员' : '普通用户'} variant={user.role === 'admin' ? 'blue' : 'neutral'} /></MetadataListItem>
                <MetadataListItem label="账户 ID"><Text type="supporting" wordBreak="break-all">{user.id}</Text></MetadataListItem>
                <MetadataListItem label="注册时间"><time dateTime={user.createdAt}>{new Date(user.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</time></MetadataListItem>
              </MetadataList>
            </VStack>
          </form>
        </LayoutContent>}
        footer={<LayoutFooter hasDivider>
          <HStack gap={2} hAlign="end">
            <Button label="取消" onClick={() => changeOpen(false)} isDisabled={pending} />
            <Button label="保存修改" type="submit" form={formId} variant="primary" isLoading={pending} />
          </HStack>
        </LayoutFooter>}
      />
    </Dialog>
  );
}
