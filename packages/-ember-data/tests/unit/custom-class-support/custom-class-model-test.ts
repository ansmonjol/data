import RSVP from 'rsvp';
import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import JSONAPIAdapter from 'ember-data/adapters/json-api';
import JSONAPISerializer from 'ember-data/serializers/json-api';
import { Snapshot } from 'ember-data/-private';
import Store from 'ember-data/store';
import { CUSTOM_MODEL_CLASS } from '@ember-data/canary-features';
import CoreStore from '@ember-data/store/-private/system/core-store';
import { StableRecordIdentifier } from '@ember-data/store/-private/ts-interfaces/identifier';
import NotificationManager from '@ember-data/store/-private/system/record-notification-manager';
import RecordDataRecordWrapper from '@ember-data/store/-private/ts-interfaces/record-data-record-wrapper';

let CustomStore, store, adapter, schemaDefinition;
if (CUSTOM_MODEL_CLASS) {
  module('unit/model - Custom Class Model', function(hooks) {
    setupTest(hooks);

    hooks.beforeEach(function() {
      let { owner } = this;

      class Person {
        constructor(public store: CoreStore) {
          this.store = store;
        }
        save() {
          return this.store.saveRecord(this);
        }
      }
      schemaDefinition = {
        attributesDefinitionFor() {
          return {
            name: {
              type: 'string',
            },
          };
        },
        relationshipsDefinitionFor() {
          return {};
        },
        doesTypeExist() {
          return true;
        },
      };

      CustomStore = Store.extend({
        init() {
          this._super(...arguments);
          this.registerSchemaDefinitionService(schemaDefinition);
        },
        instantiateRecord(identifier, createOptions, recordDataFor, notificationManager) {
          return new Person(this);
        },
        teardownRecord(record) {},
      });

      owner.register('model:person', Person);
      owner.register(
        'adapter:application',
        JSONAPIAdapter.extend({
          shouldBackgroundReloadRecord: () => false,
          createRecord: () => RSVP.reject(),
        })
      );
      owner.register('serializer:-default', JSONAPISerializer);
    });

    test('notification manager', function(assert) {
      assert.expect(9);
      let notificationCount = 0;
      let identifier;
      let recordData;
      let CreationStore = CustomStore.extend({
        createRecordDataFor() {
          let rd = this._super(...arguments);
          recordData = rd;
          return rd;
        },
        instantiateRecord(
          id: StableRecordIdentifier,
          createRecordArgs,
          recordDataFor,
          notificationManager: NotificationManager
        ): Object {
          identifier = id;
          notificationManager.subscribe(identifier, (passedId, key) => {
            notificationCount++;
            assert.equal(passedId, identifier, 'passed the identifier to the callback');
            if (notificationCount === 1) {
              assert.equal(key, 'relationships', 'passed the key');
            } else if (notificationCount === 2) {
              assert.equal(key, 'relationships', 'passed the key');
            } else if (notificationCount === 3) {
              assert.equal(key, 'state', 'passed the key');
            } else if (notificationCount === 4) {
              assert.equal(key, 'errors', 'passed the key');
            }
          });
          return { hi: 'igor' };
        },
      });
      this.owner.register('service:store', CreationStore);
      store = this.owner.lookup('service:store');
      let person = store.push({ data: { id: '1', type: 'person', name: 'chris' } });
      recordData.storeWrapper.notifyHasManyChange(identifier.type, identifier.id, identifier.lid, 'key');
      recordData.storeWrapper.notifyBelongsToChange(identifier.type, identifier.id, identifier.lid, 'key');
      recordData.storeWrapper.notifyStateChange(identifier.type, identifier.id, identifier.lid, 'key');
      recordData.storeWrapper.notifyErrorsChange(identifier.type, identifier.id, identifier.lid, 'key');
      assert.equal(notificationCount, 4, 'called notification callback');
    });

    test('record creation and teardown', function(assert) {
      assert.expect(5);
      let returnValue;
      let CreationStore = CustomStore.extend({
        instantiateRecord(identifier, createRecordArgs, recordDataFor, notificationManager) {
          assert.equal(identifier.type, 'person', 'Identifier type passed in correctly');
          assert.deepEqual(createRecordArgs, { name: 'chris' }, 'createRecordArg passed in');
          returnValue = {};
          return returnValue;
        },
        teardownRecord(record) {
          assert.equal(record, person, 'Passed in person to teardown');
        },
      });
      this.owner.register('service:store', CreationStore);
      store = this.owner.lookup('service:store');
      let person = store.createRecord('person', { name: 'chris' });
      assert.equal(returnValue, person, 'createRecord returns the instantiated record');
      assert.deepEqual(returnValue, person, 'record instantiating does not modify the returned value');
    });

    test('recordData lookup', function(assert) {
      assert.expect(3);
      let CreationStore = CustomStore.extend({
        instantiateRecord(identifier, createRecordArgs, recordDataFor, notificationManager) {
          let rd = recordDataFor(identifier);
          assert.equal(identifier.type, 'person', 'Identifier type passed in correctly');
          assert.deepEqual(createRecordArgs, { name: 'chris' }, 'createRecordArg passed in');
          return {};
        },
        teardownRecord(record) {
          assert.equal(record, person, 'Passed in person to teardown');
        },
      });
      this.owner.register('service:store', CreationStore);
      store = this.owner.lookup('service:store');
      let person = store.createRecord('person', { name: 'chris' });
    });

    test('attribute and relationship with custom schema definition', async function(assert) {
      assert.expect(18);
      this.owner.register(
        'adapter:application',
        JSONAPIAdapter.extend({
          shouldBackgroundReloadRecord: () => false,
          createRecord: (store, type, snapshot: Snapshot) => {
            let count = 0;
            snapshot.eachAttribute((attr, attrDef) => {
              if (count === 0) {
                assert.equal(attr, 'name', 'attribute key is correct');
                assert.deepEqual(attrDef, { type: 'string', key: 'name', name: 'name' }, 'attribute def matches schem');
              } else if (count === 1) {
                assert.equal(attr, 'age', 'attribute key is correct');
                assert.deepEqual(attrDef, { type: 'number', key: 'age', name: 'age' }, 'attribute def matches schem');
              }
              count++;
            });
            count = 0;
            snapshot.eachRelationship((rel, relDef) => {
              if (count === 0) {
                assert.equal(rel, 'boats', 'relationship key is correct');
                assert.deepEqual(
                  relDef,
                  {
                    type: 'ship',
                    kind: 'hasMany',
                    inverse: null,
                    options: {},
                    key: 'boats',
                  },
                  'relationships def matches schem'
                );
              } else if (count === 1) {
                assert.equal(rel, 'house', 'relationship key is correct');
                assert.deepEqual(
                  relDef,
                  { type: 'house', kind: 'belongsTo', inverse: null, options: {}, key: 'house', name: 'house' },
                  'relationship def matches schem'
                );
              }
              count++;
            });
            return RSVP.resolve({ data: { type: 'person', id: '1' } });
          },
        })
      );
      this.owner.register('service:store', CustomStore);
      store = this.owner.lookup('service:store');
      let schema = {
        attributesDefinitionFor(modelName: string) {
          assert.equal(modelName, 'person', 'type passed in to the schema hooks');
          return {
            name: {
              type: 'string',
              key: 'name',
              name: 'name',
            },
            age: {
              type: 'number',
              key: 'age',
              name: 'age',
            },
          };
        },
        relationshipsDefinitionFor(modelName: string) {
          assert.equal(modelName, 'person', 'type passed in to the schema hooks');
          return {
            boats: {
              type: 'ship',
              kind: 'hasMany',
              inverse: null,
              options: {},
              key: 'boats',
            },
            house: {
              type: 'house',
              kind: 'belongsTo',
              inverse: null,
              options: {},
              key: 'house',
              name: 'house',
            },
          };
        },
        doesTypeExist() {
          return true;
        },
      };
      store.registerSchemaDefinitionService(schema);
      let person = store.createRecord('person', { name: 'chris' });
      await person.save();
    });

    test('hasModelFor with custom schema definition', async function(assert) {
      assert.expect(4);
      this.owner.register('service:store', CustomStore);
      store = this.owner.lookup('service:store');
      let count = 0;
      let schema = {
        attributesDefinitionFor() {
          return {};
        },
        relationshipsDefinitionFor() {
          return {};
        },
        doesTypeExist(modelName: string) {
          if (count === 0) {
            assert.equal(modelName, 'person', 'type passed in to the schema hooks');
          } else if (count === 1) {
            assert.equal(modelName, 'boat', 'type passed in to the schema hooks');
          }
          count++;
          return modelName === 'person';
        },
      };
      store.registerSchemaDefinitionService(schema);
      assert.equal(store._hasModelFor('person'), true, 'hasModelFor matches schema hook when true');
      assert.equal(store._hasModelFor('boat'), false, 'hasModelFor matches schema hook when false');
    });

    test('store.saveRecord', async function(assert) {
      assert.expect(1);
      this.owner.register(
        'adapter:application',
        JSONAPIAdapter.extend({
          shouldBackgroundReloadRecord: () => false,
          createRecord: (store, type, snapshot) => {
            return RSVP.resolve({ data: { type: 'person', id: '7' } });
          },
        })
      );
      this.owner.register('service:store', CustomStore);
      store = this.owner.lookup('service:store');
      let person = store.createRecord('person', { name: 'chris' });
      let promisePerson = await store.saveRecord(person);
      assert.equal(person, promisePerson, 'save promise resolves with the same record');
    });

    test('store.deleteRecord', async function(assert) {
      let rd: RecordDataRecordWrapper;
      assert.expect(9);
      this.owner.register(
        'adapter:application',
        JSONAPIAdapter.extend({
          shouldBackgroundReloadRecord: () => false,
          deleteRecord: (store, type, snapshot) => {
            assert.ok(true, 'adapter method called');
            return RSVP.resolve();
          },
        })
      );
      let CreationStore = CustomStore.extend({
        instantiateRecord(identifier, createRecordArgs, recordDataFor, notificationManager) {
          rd = recordDataFor(identifier);
          assert.equal(rd.isDeleted!(), false, 'we are not deleted when we start');
          notificationManager.subscribe(identifier, (passedId, key) => {
            assert.equal(key, 'state', 'state change to deleted has been notified');
            assert.equal(recordDataFor(identifier).isDeleted(), true, 'we have been marked as deleted');
          });
          return {};
        },
        teardownRecord(record) {
          assert.equal(record, person, 'Passed in person to teardown');
        },
      });
      this.owner.register('service:store', CreationStore);
      store = this.owner.lookup('service:store');
      let person = store.push({ data: { type: 'person', id: '1', attributes: { name: 'chris' } } });
      store.deleteRecord(person);
      assert.equal(rd!.isDeleted!(), true, 'record has been marked as deleted');
      let promisePerson = await store.saveRecord(person);
      assert.equal(rd!.isDeletionCommitted!(), true, 'deletion has been commited');
    });

    test('record serialize', function(assert) {
      assert.expect(1);
      this.owner.register(
        'adapter:application',
        JSONAPIAdapter.extend({
          shouldBackgroundReloadRecord: () => false,
          createRecord: (store, type, snapshot) => {
            return RSVP.reject();
          },
        })
      );
      this.owner.register('service:store', CustomStore);
      store = this.owner.lookup('service:store');
      let schema = {
        attributesDefinitionFor(modelName: string) {
          if (modelName === 'person') {
            return {
              name: {
                type: 'string',
                key: 'name',
                name: 'name',
              },
            };
          } else if (modelName === 'house') {
            return {
              address: {
                type: 'string',
              },
            };
          }
        },
        relationshipsDefinitionFor(modelName: string) {
          if (modelName === 'person') {
            return {
              house: {
                type: 'house',
                kind: 'belongsTo',
                inverse: null,
                options: {},
                key: 'house',
                name: 'house',
              },
            };
          } else {
            return {};
          }
        },
        doesTypeExist() {
          return true;
        },
      };
      store.registerSchemaDefinitionService(schema);
      let person = store.push({
        data: {
          type: 'person',
          id: '7',
          attributes: { name: 'chris' },
          relationships: { house: { data: { type: 'house', id: '1' } } },
        },
      });
      let serialized = store.serializeRecord(person, { includeId: true });
      assert.deepEqual(
        {
          data: {
            id: '7',
            type: 'people',
            attributes: {
              name: 'chris',
            },
            relationships: {
              house: {
                data: {
                  type: 'houses',
                  id: '1',
                },
              },
            },
          },
        },
        serialized,
        'serializes record correctly'
      );
    });
  });
}