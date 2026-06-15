import React from 'react';
import { Select, Button, Space, Divider, Typography, DatePicker } from 'antd';
import { ReloadOutlined, ExportOutlined, FilterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import './FilterBar.less';

const { Text } = Typography;

export interface FilterOption {
  label: string;
  value: string;
}

export interface StatusItem {
  label: string;
  value: string;
}

export interface FilterBarProps {
  // 机构/主体筛选
  orgValue?: string;
  orgOptions?: FilterOption[];
  onOrgChange?: (value: string) => void;
  orgLabel?: string;

  // 会计期间日期范围筛选（精确到日）
  dateStart?: string;       // YYYY-MM-DD
  dateEnd?: string;         // YYYY-MM-DD
  onDateStartChange?: (dateStr: string) => void;
  onDateEndChange?: (dateStr: string) => void;
  periodLabel?: string;

  // 额外筛选项
  extraFilters?: React.ReactNode;

  // 操作按钮
  onRefresh?: () => void;
  onExport?: () => void;
  refreshText?: string;
  exportText?: string;
  showExport?: boolean;

  // 底部状态栏
  statusItems?: StatusItem[];

  // 右侧额外操作
  extraActions?: React.ReactNode;
}

const FilterBar: React.FC<FilterBarProps> = ({
  orgValue,
  orgOptions = [
    { label: '深圳好博', value: 'sz' },
    { label: '肇庆好博', value: 'zq' },
    { label: '全部主体', value: 'all' },
  ],
  onOrgChange,
  orgLabel = '主体',

  dateStart,
  dateEnd,
  onDateStartChange,
  onDateEndChange,
  periodLabel = '会计期间',

  extraFilters,

  onRefresh,
  onExport,
  refreshText = '刷新',
  exportText = '导出',
  showExport = true,

  statusItems,
  extraActions,
}) => {
  const defaultOrgLabel = orgOptions.find(o => o.value === orgValue)?.label || orgValue || '全部主体';

  const defaultPeriodStartLabel = dateStart || '--';
  const defaultPeriodEndLabel = dateEnd || '--';

  const hasFilters = !!orgValue || !!dateStart || !!dateEnd;

  const defaultStatus = statusItems || [
    { label: '当前主体', value: defaultOrgLabel },
    { label: '会计期间', value: dateStart && dateEnd ? `${dateStart} ~ ${dateEnd}` : '全部期间' },
  ];

  return (
    <div className="filter-bar-wrapper">
      {/* 筛选栏 */}
      <div className="filter-bar">
        <div className="filter-bar-left">
          <FilterOutlined className="filter-icon" />
          <Space size={8} wrap>
            <div className="filter-item">
              <Text type="secondary" className="filter-label">{orgLabel}</Text>
              <Select
                value={orgValue || 'all'}
                onChange={onOrgChange}
                options={orgOptions}
                className="filter-select"
                size="small"
                virtual={false}
              />
            </div>

            <div className="filter-item">
              <Text type="secondary" className="filter-label">{periodLabel}</Text>
              <DatePicker
                value={dateStart ? dayjs(dateStart) : undefined}
                onChange={(d) => onDateStartChange?.(d ? d.format('YYYY-MM-DD') : '')}
                format="YYYY-MM-DD"
                placeholder="起始日期"
                size="small"
                style={{ width: 132 }}
                allowClear={false}
              />
              <Text type="secondary" style={{ margin: '0 4px' }}>~</Text>
              <DatePicker
                value={dateEnd ? dayjs(dateEnd) : undefined}
                onChange={(d) => onDateEndChange?.(d ? d.format('YYYY-MM-DD') : '')}
                format="YYYY-MM-DD"
                placeholder="截止日期"
                size="small"
                style={{ width: 132 }}
                allowClear={false}
              />
            </div>

            {extraFilters}
          </Space>
        </div>

        <div className="filter-bar-right">
          <Space size={8}>
            <Button
              icon={<ReloadOutlined />}
              size="small"
              onClick={onRefresh}
            >
              {refreshText}
            </Button>
            {showExport && (
              <Button
                icon={<ExportOutlined />}
                size="small"
                onClick={onExport}
              >
                {exportText}
              </Button>
            )}
            {extraActions}
          </Space>
        </div>
      </div>

      {/* 底部状态栏 */}
      {(hasFilters || defaultStatus.length > 0) && (
        <div className="filter-status-bar">
          {defaultStatus.map((item, i) => (
            <React.Fragment key={item.label}>
              <Text type="secondary" className="status-label">{item.label}：</Text>
              <Text className="status-value">{item.value}</Text>
              {i < defaultStatus.length - 1 && (
                <Divider type="vertical" className="status-divider" />
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

export default FilterBar;
