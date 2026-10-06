import { EyeOutlined, SearchOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { PageContainer } from "@tsuz/ui";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Flex,
  Form,
  Image,
  Input,
  InputNumber,
  Pagination,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography
} from "antd";
import type { DescriptionsProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useRef, useState } from "react";
import { createMfeApiClient } from "../services/api-client";
import {
  listJccAdventures,
  listJccAugments,
  listJccEquipment,
  listJccGalaxies,
  listJccHeroes,
  listJccTraits,
  type JccAdventureItem,
  type JccAugmentItem,
  type JccEquipmentItem,
  type JccGalaxyItem,
  type JccHeroItem,
  type JccListResponse,
  type JccSnapshotMetadata,
  type JccTraitItem
} from "../services/jcc-api";
import { useAppStore } from "../stores/app.store";

const PAGE_SIZE = 20;

export type ResourceKey = "heroes" | "traits" | "equipment" | "augments" | "adventures" | "galaxies";

type ResourceItem = JccHeroItem | JccTraitItem | JccEquipmentItem | JccAugmentItem | JccAdventureItem | JccGalaxyItem;
type FilterValues = Record<string, string | number | undefined>;

interface JccResourcePageProps {
  resource: ResourceKey;
  title: string;
  description: string;
}

export default function JccResourcePage({ resource, title, description }: JccResourcePageProps) {
  const hostProps = useAppStore((state) => state.hostProps);
  const client = useMemo(() => createMfeApiClient(hostProps), [hostProps]);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FilterValues>({});
  const [draftFilters, setDraftFilters] = useState<FilterValues>({});
  const [selected, setSelected] = useState<ResourceItem>();
  const cardRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const paginationRef = useRef<HTMLDivElement>(null);
  const [tableScrollY, setTableScrollY] = useState(240);

  useEffect(() => {
    const updateTableScrollY = () => {
      const card = cardRef.current;
      const filters = filtersRef.current;
      const pagination = paginationRef.current;
      if (!card || !filters || !pagination) return;
      setTableScrollY(Math.max(240, card.clientHeight - filters.offsetHeight - pagination.offsetHeight - 48));
    };
    updateTableScrollY();
    const observer = new ResizeObserver(updateTableScrollY);
    if (cardRef.current) observer.observe(cardRef.current);
    if (filtersRef.current) observer.observe(filtersRef.current);
    if (paginationRef.current) observer.observe(paginationRef.current);
    return () => observer.disconnect();
  }, []);

  const query = useQuery({
    queryKey: ["jcc", resource, page, filters],
    queryFn: () => fetchResource(resource, client, { page, filters })
  });
  const columns = useMemo(() => getColumns(resource, setSelected), [resource]);
  const visibleData = query.isError ? undefined : query.data;

  useEffect(() => {
    if (!visibleData) {
      return;
    }

    const lastPage = Math.max(1, Math.ceil(visibleData.total / PAGE_SIZE));

    if (page > lastPage) {
      setSelected(undefined);
      setPage(lastPage);
    }
  }, [page, visibleData]);

  const applyFilters = () => {
    setSelected(undefined);
    setPage(1);
    setFilters(cleanFilters(draftFilters));
  };
  const resetFilters = () => {
    setSelected(undefined);
    setPage(1);
    setDraftFilters({});
    setFilters({});
  };
  const changePage = (nextPage: number) => {
    setSelected(undefined);
    setPage(nextPage);
  };

  return (
    <PageContainer className="jcc-resource-page" title={title} description={description}>
      <Card ref={cardRef} className="subapp-card jcc-resource-card">
        <div ref={filtersRef}>
          <FilterBar
            resource={resource}
            values={draftFilters}
            onChange={setDraftFilters}
            onApply={applyFilters}
            onReset={resetFilters}
          />
        </div>
        {query.isError ? (
          <Alert
            type="error"
            showIcon
            message={getErrorTitle(query.error)}
            description="请确认登录状态和 JCC 数据服务是否可用。"
            action={<Button onClick={() => void query.refetch()}>重新加载</Button>}
          />
        ) : (
          <Table<ResourceItem>
            rowKey="id"
            loading={query.isLoading}
            dataSource={visibleData?.items ?? []}
            columns={columns}
            scroll={{ x: 1350, y: tableScrollY }}
            pagination={false}
            locale={{ emptyText: "暂无资料" }}
            onRow={(record) => ({
              onClick: () => setSelected(record),
              className: "jcc-resource-row"
            })}
          />
        )}
        {!query.isError ? (
          <Flex ref={paginationRef} justify="space-between" align="center" className="jcc-pagination-row">
            <Typography.Text type="secondary">
              {query.isFetching && !query.isLoading ? <Spin size="small" /> : null}
              {visibleData ? ` 已加载 ${visibleData.items.length} 条` : "等待资料"}
            </Typography.Text>
            <Pagination
              className="subapp-pagination"
              current={page}
              pageSize={PAGE_SIZE}
              total={visibleData?.total ?? 0}
              showSizeChanger={false}
              showTotal={(total) => `共 ${total} 条`}
              onChange={changePage}
            />
          </Flex>
        ) : null}
      </Card>
      <ResourceDetail
        resource={resource}
        item={query.isError ? undefined : selected}
        onClose={() => setSelected(undefined)}
      />
    </PageContainer>
  );
}

function ResourceIntro({
  snapshot,
  total,
  unavailable = false
}: {
  snapshot?: JccSnapshotMetadata;
  total?: number;
  unavailable?: boolean;
}) {
  let summary = "正在同步当前资料快照";

  if (unavailable) {
    summary = "资料快照暂不可用";
  } else if (snapshot) {
    summary = `${snapshot.season} · ${snapshot.version} · 修订 ${snapshot.revision}`;
  }

  return (
    <div className="jcc-resource-intro">
      <div className="jcc-orbit-mark" aria-hidden="true">
        <span />
      </div>
      <div className="jcc-resource-intro-copy">
        <Typography.Text className="jcc-eyebrow">CURRENT ARCHIVE</Typography.Text>
        <Typography.Title level={3}>{snapshot?.mode_name || "JCC 资料库"}</Typography.Title>
        <Typography.Text type="secondary">{summary}</Typography.Text>
      </div>
      <div className="jcc-resource-total">
        <Typography.Text type="secondary">可用资料</Typography.Text>
        <Typography.Title level={2}>{total ?? "—"}</Typography.Title>
      </div>
    </div>
  );
}

function FilterBar({
  resource,
  values,
  onChange,
  onApply,
  onReset
}: {
  resource: ResourceKey;
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const update = (key: string, value: string | number | undefined) => onChange({ ...values, [key]: value });
  const nameKey = resource === "adventures" ? "title" : "name";

  return (
    <Flex className="subapp-filters jcc-filter-bar" gap={12} wrap="wrap" align="end">
      <Form.Item label="关键词" className="subapp-keyword">
        <Input
          allowClear
          value={String(values[nameKey] ?? "")}
          placeholder={resource === "adventures" ? "搜索特殊机制标题" : "搜索名称"}
          prefix={<SearchOutlined />}
          onChange={(event) => update(nameKey, event.target.value)}
          onPressEnter={onApply}
        />
      </Form.Item>
      {resource === "heroes" ? (
        <>
          <Form.Item label="特质 ID">
            <Input
              value={String(values.trait_id ?? "")}
              allowClear
              onChange={(event) => update("trait_id", event.target.value)}
            />
          </Form.Item>
          <Form.Item label="职业 ID">
            <Input
              value={String(values.class_id ?? "")}
              allowClear
              onChange={(event) => update("class_id", event.target.value)}
            />
          </Form.Item>
          <Form.Item label="价格">
            <InputNumber
              min={0}
              value={values.price as number}
              onChange={(value) => update("price", value ?? undefined)}
            />
          </Form.Item>
        </>
      ) : null}
      {resource === "traits" ? (
        <Form.Item label="类型">
          <Select
            allowClear
            value={values.kind}
            placeholder="全部"
            options={[
              { value: "race", label: "种族" },
              { value: "job", label: "职业" }
            ]}
            onChange={(value) => update("kind", value)}
          />
        </Form.Item>
      ) : null}
      {resource === "equipment" ? (
        <Form.Item label="类型">
          <Input
            value={String(values.type ?? "")}
            allowClear
            onChange={(event) => update("type", event.target.value)}
          />
        </Form.Item>
      ) : null}
      {resource === "augments" ? (
        <Form.Item label="等级">
          <InputNumber
            min={0}
            value={values.level as number}
            onChange={(value) => update("level", value ?? undefined)}
          />
        </Form.Item>
      ) : null}
      {resource === "adventures" ? (
        <Form.Item label="价格">
          <InputNumber
            min={0}
            value={values.price as number}
            onChange={(value) => update("price", value ?? undefined)}
          />
        </Form.Item>
      ) : null}
      <Space>
        <Button type="primary" onClick={onApply}>
          查询
        </Button>
        <Button onClick={onReset}>重置</Button>
      </Space>
    </Flex>
  );
}

function ResourceDetail({
  resource,
  item,
  onClose
}: {
  resource: ResourceKey;
  item?: ResourceItem;
  onClose: () => void;
}) {
  return (
    <Drawer open={Boolean(item)} title={item ? getItemTitle(resource, item) : "资料详情"} width={560} onClose={onClose}>
      {item ? <DetailContent resource={resource} item={item} /> : null}
    </Drawer>
  );
}

function DetailContent({ resource, item }: { resource: ResourceKey; item: ResourceItem }) {
  const imageUrl = getImageUrl(item);

  return (
    <Space direction="vertical" size="large" className="full-width jcc-detail">
      {imageUrl ? <Image className="jcc-detail-image" src={imageUrl} alt={getItemTitle(resource, item)} /> : null}
      <Descriptions bordered column={1} size="small" items={getDetailItems(resource, item)} />
    </Space>
  );
}

function getDetailItems(resource: ResourceKey, item: ResourceItem): NonNullable<DescriptionsProps["items"]> {
  const idItem = detailItem("id", "资料 ID", item.id);

  if (resource === "heroes") {
    return [idItem, ...getHeroDetailItems(item as JccHeroItem)];
  }

  if (resource === "traits") {
    return [idItem, ...getTraitDetailItems(item as JccTraitItem)];
  }

  if (resource === "equipment") {
    return [idItem, ...getEquipmentDetailItems(item as JccEquipmentItem)];
  }

  if (resource === "augments") {
    return [idItem, ...getAugmentDetailItems(item as JccAugmentItem)];
  }

  if (resource === "adventures") {
    return [idItem, ...getAdventureDetailItems(item as JccAdventureItem)];
  }

  return [idItem, ...getGalaxyDetailItems(item as JccGalaxyItem)];
}

function getHeroDetailItems(item: JccHeroItem): NonNullable<DescriptionsProps["items"]> {
  return [
    detailItem("price", "价格", formatValue(item.price)),
    detailItem("type", "类型", formatValue(item.hero_type)),
    detailItem("map", "地图 ID", formatValue(item.map_id)),
    detailItem("health", "生命 / 攻击", formatPair(item.health, item.attack_damage)),
    detailItem("armor", "护甲 / 魔抗", formatPair(item.armor, item.magic_resist)),
    detailItem("speed", "攻速 / 攻击距离", formatPair(item.attack_speed, item.attack_range)),
    detailItem("mana", "初始 / 最大法力", formatPair(item.initial_mana, item.max_mana)),
    detailItem("traits", "特质", renderTraitReferences(item.traits)),
    detailItem("classes", "职业", renderTraitReferences(item.classes)),
    detailItem("skill", "技能", formatValue(item.skill_name)),
    detailItem("skill-description", "技能说明", formatValue(item.skill_description)),
    detailItem("skill-values", "技能数值", renderKeyValues(item.skill_values)),
    detailItem("image", "英雄图片", <MediaLink url={item.image_url} label="打开英雄图片" />),
    detailItem("skill-icon", "技能图标", <MediaLink url={item.skill_icon_url} label="打开技能图标" />)
  ];
}

function getTraitDetailItems(item: JccTraitItem): NonNullable<DescriptionsProps["items"]> {
  return [
    detailItem("kind", "类型", item.kind === "race" ? "种族" : "职业"),
    detailItem("prefix", "前缀", formatValue(item.prefix)),
    detailItem("max-level", "最大等级", formatValue(item.max_level)),
    detailItem("map", "地图 ID", formatValue(item.map_id)),
    detailItem("activation", "激活人数", item.activation_list.length > 0 ? item.activation_list.join(" / ") : "-"),
    detailItem("tiers", "等级效果", renderTraitTiers(item)),
    detailItem("image", "羁绊图片", <MediaLink url={item.image_url} label="打开羁绊图片" />)
  ];
}

function getEquipmentDetailItems(item: JccEquipmentItem): NonNullable<DescriptionsProps["items"]> {
  const components =
    item.components.length > 0
      ? item.components.map((component) => <Tag key={component.id}>{`${component.name}（${component.id}）`}</Tag>)
      : "-";

  return [
    detailItem("type", "类型", formatValue(item.type)),
    detailItem("basic-description", "基础说明", formatValue(item.basic_description)),
    detailItem("description", "完整说明", formatValue(item.description)),
    detailItem("components", "合成组件", components),
    detailItem("image", "装备图片", <MediaLink url={item.image_url} label="打开装备图片" />)
  ];
}

function getAugmentDetailItems(item: JccAugmentItem): NonNullable<DescriptionsProps["items"]> {
  return [
    detailItem("level", "等级", formatValue(item.level)),
    detailItem("description", "说明", formatValue(item.description)),
    detailItem("icon", "符文图标", <MediaLink url={item.icon_url} label="打开符文图标" />)
  ];
}

function getAdventureDetailItems(item: JccAdventureItem): NonNullable<DescriptionsProps["items"]> {
  return [
    detailItem("category", "分类", formatValue(item.category)),
    detailItem("price", "价格", formatValue(item.price)),
    detailItem("description", "说明", formatValue(item.description)),
    detailItem("logo", "标志图片", <MediaLink url={item.logo_url} label="打开标志图片" />),
    detailItem("background", "背景图片", <MediaLink url={item.background_image_url} label="打开背景图片" />),
    detailItem("video", "视频", <MediaLink url={item.video_url} label="打开视频" />)
  ];
}

function getGalaxyDetailItems(item: JccGalaxyItem): NonNullable<DescriptionsProps["items"]> {
  return [
    detailItem("description", "说明", formatValue(item.description)),
    detailItem("logo", "标志图片", <MediaLink url={item.logo_url} label="打开标志图片" />),
    detailItem("background", "背景图片", <MediaLink url={item.background_image_url} label="打开背景图片" />),
    detailItem("video", "视频", <MediaLink url={item.video_url} label="打开视频" />)
  ];
}

function detailItem(
  key: string,
  label: string,
  children: NonNullable<DescriptionsProps["items"]>[number]["children"]
): NonNullable<DescriptionsProps["items"]>[number] {
  return { key, label, children };
}

function MediaLink({ url, label }: { url: string | null; label: string }) {
  return url ? (
    <a href={url} target="_blank" rel="noreferrer">
      {label}
    </a>
  ) : (
    <>-</>
  );
}

async function fetchResource(
  resource: ResourceKey,
  client: ReturnType<typeof createMfeApiClient>,
  args: { page: number; filters: FilterValues }
): Promise<JccListResponse<ResourceItem>> {
  const pagination = { limit: PAGE_SIZE, offset: (args.page - 1) * PAGE_SIZE };
  const stringFilter = (key: string) => getStringFilter(args.filters[key]);
  const numberFilter = (key: string) => getNumberFilter(args.filters[key]);

  if (resource === "heroes") {
    return listJccHeroes(client, {
      ...pagination,
      name: stringFilter("name"),
      trait_id: stringFilter("trait_id"),
      class_id: stringFilter("class_id"),
      price: numberFilter("price")
    });
  }

  if (resource === "traits") {
    const kind = args.filters.kind;

    return listJccTraits(client, {
      ...pagination,
      name: stringFilter("name"),
      kind: kind === "race" || kind === "job" ? kind : undefined
    });
  }

  if (resource === "equipment") {
    return listJccEquipment(client, {
      ...pagination,
      name: stringFilter("name"),
      type: stringFilter("type")
    });
  }

  if (resource === "augments") {
    return listJccAugments(client, {
      ...pagination,
      name: stringFilter("name"),
      level: numberFilter("level")
    });
  }

  if (resource === "adventures") {
    return listJccAdventures(client, {
      ...pagination,
      title: stringFilter("title"),
      price: numberFilter("price")
    });
  }

  return listJccGalaxies(client, {
    ...pagination,
    name: stringFilter("name")
  });
}

function getColumns(resource: ResourceKey, onSelect: (item: ResourceItem) => void): ColumnsType<ResourceItem> {
  const detailColumn = {
    title: "查看",
    key: "detail",
    width: 72,
    render: (_: unknown, item: ResourceItem) => (
      <Button
        type="text"
        size="small"
        className="jcc-detail-button"
        icon={<EyeOutlined />}
        aria-label={`查看${getItemTitle(resource, item)}详情`}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(item);
        }}
      />
    )
  };

  if (resource === "heroes") {
    return [
      imageColumn("image_url"),
      textColumn("名称", "name"),
      { title: "价格", dataIndex: "price", width: 90 },
      { title: "类型", dataIndex: "hero_type", width: 130 },
      {
        title: "特质",
        key: "traits",
        render: (_, item) => (item as JccHeroItem).traits.map((trait) => <Tag key={trait.id}>{trait.name}</Tag>)
      },
      detailColumn
    ];
  }

  if (resource === "traits") {
    return [
      imageColumn("image_url"),
      textColumn("名称", "name"),
      {
        title: "类型",
        dataIndex: "kind",
        width: 100,
        render: (value) => (value === "race" ? "种族" : "职业")
      },
      { title: "最大等级", dataIndex: "max_level", width: 100 },
      {
        title: "激活人数",
        dataIndex: "activation_list",
        render: (value: number[]) => value.join(" / ")
      },
      detailColumn
    ];
  }

  if (resource === "equipment") {
    return [
      imageColumn("image_url"),
      textColumn("名称", "name"),
      { title: "类型", dataIndex: "type", width: 140 },
      {
        title: "组件",
        dataIndex: "components",
        render: (value: JccEquipmentItem["components"]) =>
          value.map((component) => <Tag key={component.id}>{component.name}</Tag>)
      },
      detailColumn
    ];
  }

  if (resource === "augments") {
    return [
      imageColumn("icon_url"),
      textColumn("名称", "name"),
      { title: "等级", dataIndex: "level", width: 90 },
      { title: "说明", dataIndex: "description", ellipsis: true },
      detailColumn
    ];
  }

  if (resource === "adventures") {
    return [
      imageColumn("logo_url"),
      textColumn("标题", "title"),
      { title: "分类", dataIndex: "category", width: 130 },
      { title: "价格", dataIndex: "price", width: 90 },
      { title: "说明", dataIndex: "description", ellipsis: true },
      detailColumn
    ];
  }

  return [
    imageColumn("logo_url"),
    textColumn("名称", "name"),
    { title: "说明", dataIndex: "description", ellipsis: true },
    detailColumn
  ];
}

function textColumn(title: string, dataIndex: string) {
  return {
    title,
    dataIndex,
    render: (value: string) => <Typography.Text strong>{value}</Typography.Text>
  };
}

function imageColumn(key: string) {
  return {
    title: "",
    dataIndex: key,
    key,
    width: 64,
    render: (value: string | null) =>
      value ? (
        <Image preview={false} className="jcc-table-image" src={value} alt="" />
      ) : (
        <span className="jcc-table-image-placeholder" />
      )
  };
}

function renderTraitReferences(items: JccHeroItem["traits"]) {
  return items.length > 0
    ? items.map((item) => <Tag key={item.id}>{`${item.name}（${item.id} · ${item.kind}）`}</Tag>)
    : "-";
}

function renderTraitTiers(item: JccTraitItem) {
  return item.tiers.length > 0 ? (
    <Space direction="vertical" size="small">
      {item.tiers.map((tier) => (
        <div key={tier.id} className="jcc-detail-tier">
          <Typography.Text strong>
            {`顺序 ${tier.tier_order} · 等级 ${tier.level} · ${tier.activation_count} 人（${tier.id}）`}
          </Typography.Text>
          <Typography.Text>{formatValue(tier.description)}</Typography.Text>
          <Typography.Text type="secondary">{`实际说明：${formatValue(tier.real_description)}`}</Typography.Text>
        </div>
      ))}
    </Space>
  ) : (
    "-"
  );
}

function renderKeyValues(values: Record<string, string> | null) {
  const entries = Object.entries(values ?? {});

  return entries.length > 0 ? (
    <Space direction="vertical" size={2}>
      {entries.map(([key, value]) => (
        <Typography.Text key={key}>{`${key}：${value}`}</Typography.Text>
      ))}
    </Space>
  ) : (
    "-"
  );
}

function getItemTitle(resource: ResourceKey, item: ResourceItem) {
  return resource === "adventures"
    ? (item as JccAdventureItem).title
    : (item as JccHeroItem | JccTraitItem | JccEquipmentItem | JccAugmentItem | JccGalaxyItem).name;
}

function getImageUrl(item: ResourceItem) {
  return "image_url" in item
    ? item.image_url
    : "icon_url" in item
      ? item.icon_url
      : "logo_url" in item
        ? item.logo_url
        : null;
}

function cleanFilters(filters: FilterValues) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""));
}

function getStringFilter(value: string | number | undefined) {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function getNumberFilter(value: string | number | undefined) {
  return typeof value === "number" ? value : undefined;
}

function formatPair(left: number | null, right: number | null) {
  return `${formatValue(left)} / ${formatValue(right)}`;
}

function formatValue(value: string | number | null) {
  return value ?? "-";
}

function getErrorTitle(error: unknown) {
  const status = error && typeof error === "object" && "status" in error ? error.status : undefined;

  return status === 503 ? "JCC 资料暂不可用" : status === 401 ? "登录状态已失效" : "资料加载失败";
}
