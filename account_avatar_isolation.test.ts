import {describe,it,expect} from 'vitest';
import {AccountSessionGuard, AvatarWriteGuard} from './src/utils/accountIsolation';
import {profileMatchesUser} from './src/utils/stateEquality';
import {findCustomerForBooking} from './src/utils/bookingCustomer';
import type {UserProfile} from './src/types/bikeShop';
const customer=(uid:string, membershipNumber='153', email='benstake13@gmail.com', avatarColor='customer-face'):UserProfile => ({uid,membershipNumber,email,avatarColor,displayName:'Ben',role:'customer',bikes:[],stamps:0,tickets:0,points:0,createdAt:new Date(0)});

describe('account-scoped synchronization',()=>{
 it('rejects admin syncs and activation responses after switching to the customer',async()=>{
  const guard=new AccountSessionGuard();
  const admin=guard.begin();expect(guard.activate(admin,'admin')).toBe(true);
  let release!:()=>void;const delayed=new Promise<void>(resolve=>{release=resolve;});
  let visibleAvatar='customer-face';
  const oldPoll=delayed.then(()=>{if(guard.matches(admin,'admin'))visibleAvatar='admin-face';});
  const next=guard.begin();guard.activate(next,'customer');release();await oldPoll;
  expect(visibleAvatar).toBe('customer-face');expect(guard.activate(admin,'admin')).toBe(false);
 });
 it('invalidates work after logout, including logout and login to the same account',()=>{
  const guard=new AccountSessionGuard();const first=guard.begin();guard.activate(first,'customer');
  guard.begin();expect(guard.matches(first,'customer')).toBe(false);
  const second=guard.begin();guard.activate(second,'customer');
  expect(guard.matches(first,'customer')).toBe(false);expect(guard.matches(second,'customer')).toBe(true);
 });
 it('does not let an old restore overwrite a manually activated account',()=>{
  const guard=new AccountSessionGuard();const restore=guard.snapshot();const login=guard.begin();
  guard.activate(login,'customer');expect(guard.activate(restore,'admin')).toBe(false);
  expect(guard.activate(login,'admin')).toBe(false);
 });
 it('keeps different known UUIDs separate even if memberships match',()=>{
  expect(profileMatchesUser(customer('customer'),customer('admin'))).toBe(false);
  expect(profileMatchesUser(customer('customer'),customer('customer','changed'))).toBe(true);
  expect(profileMatchesUser({membershipNumber:'153'},customer('customer'))).toBe(true);
 });
});

describe('avatar writes versus background polls',()=>{
 it('preserves a new avatar through polls started before or during its save, only for its owner',()=>{
  const guard=new AvatarWriteGuard();const before=guard.snapshot();const write=guard.begin('customer','new-face','old-face');
  const during=guard.snapshot();
  expect(guard.reconcile(customer('customer'),before).avatarColor).toBe('new-face');
  expect(guard.reconcile(customer('admin','other','admin@example.com','admin-face'),before).avatarColor).toBe('admin-face');
  guard.finish('customer',write,true);
  expect(guard.reconcile(customer('customer'),during).avatarColor).toBe('new-face');
  expect(guard.reconcile(customer('customer','153','benstake13@gmail.com','canonical-face'),guard.snapshot()).avatarColor).toBe('canonical-face');
 });
 it('restores the previous avatar after a failed save and ignores older write completions',()=>{
  const guard=new AvatarWriteGuard();const first=guard.begin('customer','first-face','old-face');
  const second=guard.begin('customer','second-face','first-face');
  expect(guard.finish('customer',first,false)).toBe(false);
  const pending=guard.snapshot();expect(guard.finish('customer',second,false)).toBe(true);
  expect(guard.reconcile(customer('customer'),pending).avatarColor).toBe('first-face');
 });
 it('accepts an explicit avatar reset from a fresh canonical read',()=>{
  const guard=new AvatarWriteGuard();const revision=guard.begin('customer','new-face');guard.finish('customer',revision,true);
  expect(guard.reconcile({...customer('customer'),avatarColor:undefined},guard.snapshot()).avatarColor).toBeUndefined();
 });
});

describe('booking avatar ownership',()=>{
 const booking={customerId:'customer',membershipNumber:'153',customerEmail:'benstake13@gmail.com'};
 it('finds the UUID owner even when an admin with conflicting contact fields comes first',()=>{
  const admin={...customer('admin'),role:'admin' as const,avatarColor:'admin-face'};
  const member=customer('customer');expect(findCustomerForBooking(booking,[admin,member])).toBe(member);
 });
 it('never substitutes contact-field matches when the explicit owner is missing',()=>{
  expect(findCustomerForBooking(booking,[customer('admin')])).toBeUndefined();
 });
 it('supports a unique legacy membership without choosing an ambiguous profile',()=>{
  expect(findCustomerForBooking({...booking,customerId:''},[customer('member')])?.uid).toBe('member');
  expect(findCustomerForBooking({...booking,customerId:''},[customer('admin'),customer('member')])).toBeUndefined();
 });
 it('uses unique email only when neither an ID nor membership is present',()=>{
  expect(findCustomerForBooking({...booking,customerId:'',membershipNumber:''},[customer('member')])?.uid).toBe('member');
  expect(findCustomerForBooking({...booking,customerId:'',membershipNumber:''},[customer('a'),customer('b')])).toBeUndefined();
 });
});
