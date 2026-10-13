/** Conservative BLE identification: read-only, no undocumented ESC writes. */
export const PROFILES = Object.freeze([
 {id:'ninebot-xiaomi',label:'Ninebot / Xiaomi',services:['0000fea0-0000-1000-8000-00805f9b34fb','0000fea1-0000-1000-8000-00805f9b34fb'],names:/ninebot|segway|xiaomi|m365|mi scooter|nb-/i},
 {id:'minirobot',label:'MiniRobot / AOVO',services:['0000ffe0-0000-1000-8000-00805f9b34fb'],names:/minirobot|aovo|smart scooter/i},
 {id:'tuya',label:'Tuya / Generic',services:['0000fd4d-0000-1000-8000-00805f9b34fb'],names:/tuya/i}
]);
const norm = value => String(value||'').toLowerCase().replace(/^([0-9a-f]{4})$/,'0000$1-0000-1000-8000-00805f9b34fb');
export function parseSerial(bytes) {
 const raw = bytes instanceof DataView ? new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength) : new Uint8Array(bytes);
 const printable = Array.from(raw).map(b=>b>=32&&b<=126?String.fromCharCode(b):'').join('');
 const match = printable.match(/[A-Z0-9]{14}/i);
 return match ? match[0] : null;
}
export function identifyModel(serial) {
 if (!serial) return {model:null,confidence:'unknown'};
 const prefix=serial.toUpperCase();
 if(prefix.startsWith('N2G')) return {model:'Ninebot MAX G30 (candidate)',confidence:'tentative'};
 if(prefix.startsWith('21287')) return {model:'Xiaomi Pro 2 (candidate)',confidence:'tentative'};
 return {model:null,confidence:'unknown'};
}
export function assessFirmwareSafety({ble,esc,bms,model,compatibilityRecord}={}) {
 const complete=Boolean(ble&&esc&&bms&&model);
 const verified=Boolean(compatibilityRecord?.verified===true && compatibilityRecord?.model===model && compatibilityRecord?.ble===ble && compatibilityRecord?.esc===esc && compatibilityRecord?.bms===bms && compatibilityRecord?.allowsFlash===true);
 return {allowed:complete&&verified,reason:!complete?'Missing confirmed model or BLE/ESC/BMS firmware versions':!verified?'Firmware compatibility / anti-rollback status unverified — flashing blocked. ST-Link may be required for a supported recovery procedure.':'Verified firmware compatibility'};
}
export class ScooterDetector {
 constructor({bluetooth=globalThis.navigator?.bluetooth}={}) { this.bluetooth=bluetooth; this.device=null; }
 classify({name='',serviceUuids=[]}={}) {
  const uuids=serviceUuids.map(norm);
  const byService=PROFILES.filter(p=>p.services.some(s=>uuids.includes(s)));
  const candidates=byService.length?byService:PROFILES.filter(p=>p.names.test(name));
  return {family:candidates.length===1?candidates[0].id:'unknown',confidence:byService.length===1?'service-match':candidates.length===1?'name-only':'unknown',candidates:candidates.map(p=>p.id)};
 }
 async scan() {
  if(!this.bluetooth?.requestDevice) throw Error('BLE unavailable. Use a supported browser or native BLE host.');
  this.device=await this.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:[...new Set(PROFILES.flatMap(p=>p.services))]});
  return {device:this.device,identification:this.classify({name:this.device.name,serviceUuids:this.device.uuids||[]})};
 }
 async connect() {if(!this.device) throw Error('Select a scooter first'); return this.device.gatt.connect();}
 /** Device-specific authenticated read commands must be provided by a verified driver.
     A bare 0x55 0xAA prefix + register 0x10 is NOT a universally valid read frame. */
 async readIdentity(driver) {
  if(!driver?.readSerial || !driver?.readVersions) throw Error('No verified read-only protocol driver for this controller');
  const serial=await driver.readSerial(); const versions=await driver.readVersions();
  return {serial,model:identifyModel(serial),versions,safety:assessFirmwareSafety({...versions,model:identifyModel(serial).model})};
 }
 disconnect(){this.device?.gatt?.disconnect();this.device=null;}
}
export default ScooterDetector;
