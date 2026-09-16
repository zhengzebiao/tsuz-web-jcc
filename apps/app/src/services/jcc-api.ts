import type { ApiClient } from "@tsuz/api";

export interface JccSnapshotMetadata {
  mode: string;
  mode_name: string;
  season: string;
  version: string;
  revision: number;
  content_hash: string;
  source_updated_at: string | null;
}

export interface JccListResponse<T> {
  snapshot: JccSnapshotMetadata;
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface JccTraitReference {
  id: string;
  name: string;
  kind: "race" | "job";
}

export interface JccHeroItem {
  id: string;
  name: string;
  price: number | null;
  hero_type: string | null;
  map_id: number | null;
  health: number | null;
  attack_damage: number | null;
  armor: number | null;
  magic_resist: number | null;
  attack_speed: number | null;
  attack_range: number | null;
  initial_mana: number | null;
  max_mana: number | null;
  skill_name: string | null;
  skill_description: string | null;
  skill_values: Record<string, string> | null;
  image_url: string | null;
  skill_icon_url: string | null;
  traits: JccTraitReference[];
  classes: JccTraitReference[];
}

export interface JccTraitTierItem {
  id: string;
  tier_order: number;
  activation_count: number;
  level: number;
  description: string | null;
  real_description: string | null;
}

export interface JccTraitItem {
  id: string;
  kind: "race" | "job";
  name: string;
  prefix: string | null;
  max_level: number | null;
  activation_list: number[];
  image_url: string | null;
  map_id: number | null;
  tiers: JccTraitTierItem[];
}

export interface JccEquipmentComponent {
  id: string;
  name: string;
}

export interface JccEquipmentItem {
  id: string;
  name: string;
  type: string | null;
  basic_description: string | null;
  description: string | null;
  image_url: string | null;
  components: JccEquipmentComponent[];
}

export interface JccAugmentItem {
  id: string;
  name: string;
  level: number | null;
  description: string | null;
  icon_url: string | null;
}

export interface JccAdventureItem {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  category: string | null;
  logo_url: string | null;
  video_url: string | null;
  background_image_url: string | null;
}

export interface JccGalaxyItem {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  video_url: string | null;
  background_image_url: string | null;
}

export interface JccPaginationParams {
  limit: number;
  offset: number;
}

export interface JccHeroesParams extends JccPaginationParams {
  name?: string;
  trait_id?: string;
  class_id?: string;
  price?: number;
}

export interface JccTraitsParams extends JccPaginationParams {
  kind?: "race" | "job";
  name?: string;
}

export interface JccEquipmentParams extends JccPaginationParams {
  name?: string;
  type?: string;
}

export interface JccAugmentsParams extends JccPaginationParams {
  name?: string;
  level?: number;
}

export interface JccAdventuresParams extends JccPaginationParams {
  title?: string;
  price?: number;
}

export interface JccGalaxiesParams extends JccPaginationParams {
  name?: string;
}

export function listJccHeroes(client: ApiClient, params: JccHeroesParams) {
  return client.get<JccListResponse<JccHeroItem>>("/jcc/heroes", { query: cleanQuery(params) });
}

export function listJccTraits(client: ApiClient, params: JccTraitsParams) {
  return client.get<JccListResponse<JccTraitItem>>("/jcc/traits", { query: cleanQuery(params) });
}

export function listJccEquipment(client: ApiClient, params: JccEquipmentParams) {
  return client.get<JccListResponse<JccEquipmentItem>>("/jcc/equipment", { query: cleanQuery(params) });
}

export function listJccAugments(client: ApiClient, params: JccAugmentsParams) {
  return client.get<JccListResponse<JccAugmentItem>>("/jcc/augments", { query: cleanQuery(params) });
}

export function listJccAdventures(client: ApiClient, params: JccAdventuresParams) {
  return client.get<JccListResponse<JccAdventureItem>>("/jcc/adventures", { query: cleanQuery(params) });
}

export function listJccGalaxies(client: ApiClient, params: JccGalaxiesParams) {
  return client.get<JccListResponse<JccGalaxyItem>>("/jcc/galaxies", { query: cleanQuery(params) });
}

function cleanQuery(params: object): Record<string, string | number | undefined> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== "")
  ) as Record<string, string | number | undefined>;
}
