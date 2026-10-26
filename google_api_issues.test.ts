import {describe,expect,it} from 'vitest';
import {describeGoogleIssue} from './api/business/_googleIssues.js';
describe('Google Business quota diagnostics',()=>{
 it('identifies zero quota as access approval rather than a paid tier limit',()=>{
 const issue=describeGoogleIssue({error:{message:'Quota exceeded',details:[{'@type':'type.googleapis.com/google.rpc.ErrorInfo',metadata:{quota_limit_value:'0',consumer:'projects/900853061623'}}]}},429);
 expect(issue?.code).toBe('GOOGLE_ACCESS_NOT_APPROVED');expect(issue?.message).toMatch(/Basic API Access/);expect(issue?.message).not.toMatch(/upgrade|payment/i);expect(issue?.quotaLimit).toBe(0);
 });
 it('does not assert zero quota when Google did not report its configured limit',()=>{
 const issue=describeGoogleIssue({error:{message:'Quota exceeded'}},429);expect(issue?.code).toBe('GOOGLE_QUOTA_LIMIT');expect(issue?.quotaLimit).toBeNull();expect(issue?.message).toMatch(/check/i);
 });
 it('distinguishes temporary usage limits from missing approval',()=>{
 const issue=describeGoogleIssue({error:{details:[{metadata:{quota_limit_value:'300'}}]}},429);expect(issue?.code).toBe('GOOGLE_QUOTA_LIMIT');expect(issue?.quotaLimit).toBe(300);
 });
 it('keeps only safe diagnostic fields rather than arbitrary provider metadata',()=>{
 const issue=describeGoogleIssue({error:{message:'PRIVATE',details:[{metadata:{quota_limit_value:'0',access_token:'PRIVATE_TOKEN'}}]}},429);expect(JSON.stringify(issue)).not.toContain('PRIVATE');
 });
});
it('uses disabled API context even when its metadata has no quota value',()=>{
 const issue=describeGoogleIssue({error:{details:[{reason:'SERVICE_DISABLED',metadata:{service:'businessprofileperformance.googleapis.com',consumer:'projects/123456789'}}]}},403);
 expect(issue?.actionUrl).toContain('businessprofileperformance.googleapis.com');expect(issue?.actionUrl).toContain('project=123456789');
});
