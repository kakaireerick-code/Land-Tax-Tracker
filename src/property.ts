export interface Property {
  id: number;
  plotNumber: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail?: string;
  district: string;
  subCounty: string;
  parish?: string;
  village?: string;
  propertyType: string;
  landTitleNumber: string;
  lat: number;
  lng: number;
  annualTaxDue: number;
  principalOwed: number;
  taxDueDate: string;
  lastPaymentDate: string | null;
  tenantName: string | null;
  tenantPhone: string | null;
  rentalIncomeDeclared: number;
  status: 'delinquent' | 'paid' | 'partial';
  enforcementStage: string;
  notes: string;
  imported?: boolean;
}
