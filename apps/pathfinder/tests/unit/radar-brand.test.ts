import { describe,it,expect } from 'vitest';
import { resolveBrand } from '../../src/lib/brand';
describe('RADAR deployment identity',()=>{
 it('uses RADAR identity without impersonating the upstream operator',()=>{
  const brand=resolveBrand('radar');expect(brand.productName).toBe('RADAR Facilities');expect(brand.operatorLegalName).toBe('RADAR Campus Explorer');expect(brand.supportEmail).toBe('');expect(brand.domains).toEqual([]);
 });
});
