import { RecordIdentifier, StableRecordIdentifier } from '../ts-interfaces/identifier';
import CoreStore from './core-store';

type UnsubscribeToken = Object;

const Cache = new WeakMap<StableRecordIdentifier, NotificationCallback>();
const Tokens = new WeakMap<UnsubscribeToken, StableRecordIdentifier>();

interface NotificationCallback {
  (
    identifier: RecordIdentifier,
    notificationType: 'attributes' | 'relationships' | 'identity' | 'errors' | 'meta' | 'unload' | 'property' | 'state'
  ): void;
}

export function unsubscribe(token: UnsubscribeToken) {
  let identifier = Tokens.get(token);
  if (!identifier) {
    throw 'Passed unknown unsubscribe token to unsubscribe';
  }
  Cache.delete(identifier);
}
/*
  Currently only support a single callback per identifier
*/
export default class NotificationManager {
  constructor(private store: CoreStore) {}

  subscribe(identifier: RecordIdentifier, callback: NotificationCallback): UnsubscribeToken {
    let stableId = this.store._stableIdentifierFor(identifier);
    Cache.set(stableId, callback);
    let unsubToken = new Object();
    Tokens.set(unsubToken, stableId);
    return identifier;
  }

  notify(
    identifier: RecordIdentifier,
    value: 'attributes' | 'relationships' | 'errors' | 'meta' | 'identity' | 'unload' | 'property' | 'state'
  ): boolean {
    let stableId = this.store._stableIdentifierFor(identifier);
    let callback = Cache.get(stableId);
    if (!callback) {
      return false;
    }
    callback(stableId, value);
    return true;
  }
}
