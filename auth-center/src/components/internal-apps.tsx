'use client';

import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Icon } from '@astryxdesign/core/Icon';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Table } from '@astryxdesign/core/Table';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TablePager, useTablePage } from '@/components/table-pagination';

export function InternalApps() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const hasFilters = Boolean(query.trim()) || status !== 'all';
  const pagination = useTablePage([]);

  function changeQuery(value: string) {
    setQuery(value);
    pagination.resetPage();
  }

  function clearFilters() {
    setQuery('');
    setStatus('all');
    pagination.resetPage();
  }

  return (
    <VStack as="section" gap={4} aria-label="内部子应用列表">
      <HStack gap={3} vAlign="center" wrap="wrap">
        <VStack className="search-field">
          <TextInput label="搜索子应用" type="search" isLabelHidden value={query} onChange={changeQuery} placeholder="搜索子应用"
            startIcon={<Icon icon="search" size="sm" />} hasClear width="100%" />
        </VStack>
        <Selector label="子应用状态" isLabelHidden value={status} onChange={(value) => {
          setStatus(value);
          pagination.resetPage();
        }} options={[
          { value: 'all', label: '全部状态' },
          { value: 'active', label: '启用' },
          { value: 'disabled', label: '停用' },
        ]} width={130} />
      </HStack>
      <Card padding={0}>
        <Table aria-label="内部子应用" data={pagination.data} rowIndexStart={pagination.rowIndexStart} rowCount={0} idKey="id" density="balanced" textOverflow="truncate" hasHover emptyState={<EmptyState title={hasFilters ? '没有匹配的子应用' : '暂无内部子应用'} icon={<Icon icon="wrench" size="lg" />} actions={hasFilters ? <Button label="清空筛选" onClick={clearFilters} /> : undefined} />} columns={[
          { key: 'name', header: '应用名称' },
          { key: 'homepage', header: '应用地址' },
          { key: 'status', header: '状态' },
          { key: 'actions', header: '操作', align: 'end' },
        ]} />
      </Card>
      <TablePager {...pagination.controls} label="内部子应用分页" />
    </VStack>
  );
}
