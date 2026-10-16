/** A request belongs to one login, including when the same person logs in again. */
export class AccountSessionGuard {
  private generation = 0;
  private uid: string | null = null;

  begin(): number {
    this.uid = null;
    return ++this.generation;
  }

  activate(generation: number, uid: string): boolean {
    if (generation !== this.generation || (this.uid !== null && this.uid !== uid)) return false;
    this.uid = uid;
    return true;
  }

  snapshot(): number { return this.generation; }

  matches(generation: number, uid?: string): boolean {
    return generation === this.generation && (uid === undefined || uid === this.uid);
  }
}

/** Protect an avatar edit from older polls without applying it to another UID. */
export class AvatarWriteGuard {
  private revision = 0;
  private writes = new Map<string, {revision: number; value?: string; previous?: string; pending: boolean}>();

  snapshot(): number { return this.revision; }

  begin(uid: string, value: string, previous?: string): number {
    const revision = ++this.revision;
    this.writes.set(uid, {revision, value, previous, pending:true});
    return revision;
  }

  finish(uid: string, revision: number, saved: boolean): boolean {
    const write = this.writes.get(uid);
    if (!write || write.revision !== revision) return false;
    this.writes.set(uid, {...write, revision:++this.revision, value:saved ? write.value : write.previous, pending:false});
    return true;
  }

  reconcile<T extends {uid: string; avatarColor?: string}>(profile: T, requestRevision: number): T {
    const write = this.writes.get(profile.uid);
    return write && (write.pending || write.revision > requestRevision) ? {...profile, avatarColor:write.value} : profile;
  }
}
