export interface AssetComponent {
  name: string;
  version?: string;
}

export interface AssetPort {
  port: number;
  protocol: string;
  service?: string;
  status: string;
  component?: string;
}

export interface Asset {
  id: number;
  name: string;
  address: string;
  type: string;
  responsible_person?: string;
  department?: string;
  asset_group?: string;
  source?: string;
  network_type?: string;
  importance_level?: string;
  discovery_date: string;
  update_date?: string;
  components: AssetComponent[];
  ports: AssetPort[];
  business_system?: string;
  business_impact?: string;
  exposure?: string;
  vulnerabilities_summary: Record<string, number>;
}

export interface AssetCreate {
  name: string;
  address: string;
  type: string;
  responsible_person?: string;
  department?: string;
  asset_group?: string;
  source?: string;
  network_type?: string;
  importance_level?: string;
  components?: AssetComponent[];
  ports?: AssetPort[];
  business_system?: string;
  business_impact?: string;
  exposure?: string;
}

export interface AssetUpdate {
  name?: string;
  address?: string;
  type?: string;
  responsible_person?: string;
  department?: string;
  asset_group?: string;
  source?: string;
  network_type?: string;
  importance_level?: string;
  components?: AssetComponent[];
  ports?: AssetPort[];
  business_system?: string;
  business_impact?: string;
  exposure?: string;
} 