import { DISTRICT_NAMES, DISTRICTS_BY_REGION, type UgandaRegion } from '../data/districts';

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  includeAll?: boolean;
};

export function FlatDistrictSelect({ value, onChange, className, id, includeAll }: SelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      {includeAll && <option value="">All Districts</option>}
      {DISTRICT_NAMES.map((d) => (
        <option key={d} value={d}>{d}</option>
      ))}
    </select>
  );
}

export function GroupedDistrictSelect({ value, onChange, className, id, includeAll }: SelectProps) {
  const groups: { label: string; region: UgandaRegion }[] = [
    { label: 'Central Region', region: 'Central' },
    { label: 'Eastern Region', region: 'Eastern' },
    { label: 'Northern Region', region: 'Northern' },
    { label: 'Western Region', region: 'Western' },
  ];

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      {includeAll && <option value="">All Districts</option>}
      {groups.map(({ label, region }) => (
        <optgroup key={region} label={label}>
          {DISTRICTS_BY_REGION[region].map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
