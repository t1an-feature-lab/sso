'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { DropdownMenu, DropdownMenuDivider, DropdownMenuItem } from '@astryxdesign/core/DropdownMenu';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Icon } from '@astryxdesign/core/Icon';
import { Selector } from '@astryxdesign/core/Selector';
import { Table, proportional, pixel } from '@astryxdesign/core/Table';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import type { ManagedUser } from '@/common/types';
import { useAppToast } from '@/components/app-toast';
import { TablePager, useTablePage } from '@/components/table-pagination';
import { deleteUserAction, resetUserPasswordAction, updateUserRoleAction } from '@/server/actions';

const roleOptions = [
  { value: 'admin', label: '管理员' },
  { value: 'user', label: '普通用户' },
];

function UserRoleControl({ user, isCurrentUser }: { user: ManagedUser; isCurrentUser: boolean }) {
  const router = useRouter();
  const toast = useAppToast();
  const [isSaving, startSave] = useTransition();
  const submissionPending = useRef(false);

  function changeRole(role: string) {
    if (user.isBuiltIn || isCurrentUser || isSaving || submissionPending.current || role === user.role || (role !== 'admin' && role !== 'user')) return;
    const data = new FormData();
    data.set('id', user.id);
    data.set('role', role);
    submissionPending.current = true;
    startSave(async () => {
      try {
        const result = await updateUserRoleAction({}, data);
        if (result.error) {
          toast({ body: result.error, type: 'error', uniqueID: `user-role-${user.id}` });
          return;
        }
        toast({ body: result.success ?? '用户权限已更新', uniqueID: `user-role-${user.id}` });
        router.refresh();
      } catch {
        toast({ body: '权限修改失败，请稍后重试', type: 'error', uniqueID: `user-role-${user.id}` });
      } finally {
        submissionPending.current = false;
      }
    });
  }

  return (
    <Selector
      label={`${user.username} 的角色`}
      isLabelHidden
      value={user.role}
      onChange={changeRole}
      options={roleOptions}
      renderValue={(option) => <Badge label={option.label} variant={option.value === 'admin' ? 'blue' : 'neutral'} />}
      isDisabled={user.isBuiltIn || isCurrentUser || isSaving}
      disabledMessage={user.isBuiltIn ? '内置 admin 的身份不可修改' : isCurrentUser ? '不能修改自己的权限' : undefined}
      isLoading={isSaving}
      variant="ghost"
      size="sm"
      width="100%"
    />
  );
}

export function UsersTable({ users, currentUserId }: { users: ManagedUser[]; currentUserId: string }) {
  const router = useRouter();
  const toast = useAppToast();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [confirmation, setConfirmation] = useState<{ user: ManagedUser; type: 'reset' | 'delete' } | null>(null);
  const [pending, setPending] = useState(false);
  const actionInFlight = useRef(false);
  const hasFilters = Boolean(query.trim()) || role !== 'all';
  const filtered = users.filter((user) =>
    (role === 'all' || user.role === role) &&
    `${user.username} ${user.phone ?? ''} ${user.role === 'admin' ? '管理员' : '普通用户'}`
      .toLowerCase().includes(query.trim().toLowerCase()),
  );
  const pagination = useTablePage(filtered);

  function changeQuery(value: string) {
    setQuery(value);
    pagination.resetPage();
  }

  function clearFilters() {
    setQuery('');
    setRole('all');
    pagination.resetPage();
  }

  function openAction(user: ManagedUser, type: 'reset' | 'delete') {
    if (pending || actionInFlight.current) return;
    if (type === 'delete' && (user.isBuiltIn || user.id === currentUserId)) return;
    setConfirmation({ user, type });
  }

  async function confirmAction() {
    if (!confirmation || pending || actionInFlight.current) return;
    const { user, type } = confirmation;
    if (type === 'delete' && (user.isBuiltIn || user.id === currentUserId)) return;
    actionInFlight.current = true;
    setPending(true);
    const data = new FormData();
    data.set('id', user.id);
    try {
      const action = type === 'delete' ? deleteUserAction : resetUserPasswordAction;
      const result = await action({}, data);
      if (result.error) {
        toast({ body: result.error, type: 'error', uniqueID: 'user-action' });
        return;
      }
      setConfirmation(null);
      toast({ body: result.success ?? (type === 'delete' ? '用户已删除' : '密码已重置'), uniqueID: 'user-action' });
      if (type === 'delete') router.refresh();
    } catch {
      toast({ body: type === 'delete' ? '用户删除失败，请稍后重试' : '密码重置失败，请稍后重试', type: 'error', uniqueID: 'user-action' });
    } finally {
      actionInFlight.current = false;
      setPending(false);
    }
  }

  return (
    <VStack as="section" gap={4} aria-label="用户列表">
      <HStack gap={3} vAlign="center" wrap="wrap">
        <VStack className="search-field">
          <TextInput label="搜索用户" type="search" isLabelHidden placeholder="搜索用户名或手机号" value={query}
            onChange={changeQuery} startIcon={<Icon icon="search" size="sm" />} hasClear width="100%" />
        </VStack>
        <Selector label="用户角色" isLabelHidden value={role} onChange={(value) => {
          setRole(value);
          pagination.resetPage();
        }} options={[
          { value: 'all', label: '全部角色' },
          { value: 'admin', label: '管理员' },
          { value: 'user', label: '普通用户' },
        ]} width={130} />
      </HStack>
      <Card padding={0}>
        <Table aria-label="用户与权限" data={pagination.data} rowIndexStart={pagination.rowIndexStart} rowCount={filtered.length} idKey="id" density="balanced" textOverflow="truncate" hasHover emptyState={<EmptyState title={hasFilters ? '没有匹配的用户' : '暂无用户'} icon={<Icon icon="search" size="lg" />} actions={hasFilters ? <Button label="清空筛选" onClick={clearFilters} /> : undefined} />}
          columns={[
            { key: 'username', header: '用户', width: proportional(1.25, { minWidth: 200 }), renderCell: (user) => (
              <HStack gap={3} vAlign="center">
                <Avatar src={user.avatarUrl || undefined} name={user.username} size="md" tooltip={false} />
                <StackItem size="fill"><Text type="label" maxLines={1} style={{ minInlineSize: 0, maxInlineSize: "15rem" }}>{user.username}</Text></StackItem>
              </HStack>
            ) },
            { key: 'phone', header: '手机号', width: proportional(1, { minWidth: 160 }), renderCell: (user) => <Text maxLines={1} style={{ minInlineSize: 0, maxInlineSize: "20rem" }} hasTabularNumbers>{user.phone ?? '—'}</Text> },
            { key: 'role', header: '角色', width: proportional(0.75, { minWidth: 150 }), renderCell: (user) => (
              <UserRoleControl user={user} isCurrentUser={user.id === currentUserId} />
            ) },
            { key: 'createdAt', header: '注册时间', width: proportional(1, { minWidth: 170 }), renderCell: (user) => (
              <Text color="secondary" maxLines={1} style={{ minInlineSize: 0, maxInlineSize: "20rem" }} hasTabularNumbers><time dateTime={user.createdAt}>{new Date(user.createdAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })}</time></Text>
            ) },
            { key: 'actions', header: '操作', width: pixel(72), align: 'end', renderCell: (user) => user.isBuiltIn ? null : (
              <DropdownMenu
                button={{ label: `${user.username} 的操作`, icon: <Icon icon="moreHorizontal" />, isIconOnly: true, variant: 'ghost', size: 'sm', isDisabled: pending }}
                hasChevron={false}
                alignment="end"
                menuWidth={180}
              >
                <DropdownMenuItem label="重置密码" onClick={() => openAction(user, 'reset')} />
                <DropdownMenuDivider />
                <DropdownMenuItem
                  label="删除用户"
                  variant="destructive"
                  isDisabled={user.isBuiltIn || user.id === currentUserId}
                  description={user.isBuiltIn ? '内置 admin 不可删除' : user.id === currentUserId ? '不能删除当前登录用户' : undefined}
                  onClick={() => openAction(user, 'delete')}
                />
              </DropdownMenu>
            ) },
          ]}
        />
      </Card>
      <TablePager {...pagination.controls} label="用户分页" />
      <AlertDialog
        isOpen={confirmation !== null}
        onOpenChange={(open) => { if (!actionInFlight.current && !open) setConfirmation(null); }}
        title={confirmation?.type === 'delete' ? '删除用户？' : '重置用户密码？'}
        description={confirmation?.type === 'delete'
          ? `将永久删除“${confirmation.user.username}”及其创建的应用和授权数据，此操作无法撤销`
          : `将“${confirmation?.user.username ?? ''}”的密码重置为 user12345，该用户的其他登录会话将失效`}
        actionLabel={confirmation?.type === 'delete' ? '删除用户' : '重置密码'}
        cancelLabel="取消"
        onAction={confirmAction}
        isActionLoading={pending}
      />
    </VStack>
  );
}
