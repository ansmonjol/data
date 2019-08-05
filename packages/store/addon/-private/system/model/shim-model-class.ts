import CoreStore from '../core-store';
import { RelationshipSchema, AttributeSchema } from '../../ts-interfaces/record-data-schemas';

// Mimics the static apis of DSModel
export default class ShimModelClass {
  store: CoreStore;
  modelName: string;
  _id?: string;

  // TODO Maybe expose the class here?
  constructor(store: CoreStore, modelName: string, id?: string) {
    this.store = store;
    this.modelName = modelName;
    this._id = id;
  }

  get fields(): Map<string, 'attribute' | 'belongsTo' | 'hasMany'> {
    let attrs = this.store._attributesDefinitionFor(this.modelName, this._id);
    let relationships = this.store._relationshipsDefinitionFor(this.modelName, this._id);
    let fields = new Map<string, 'attribute' | 'belongsTo' | 'hasMany'>();
    Object.keys(attrs).forEach(key => fields.set(key, 'attribute'));
    Object.keys(relationships).forEach(key => fields.set(key, relationships[key]!.kind));
    return fields;
  }

  get attributes(): Map<string, AttributeSchema> {
    let attrs = this.store._attributesDefinitionFor(this.modelName, this._id);
    return new Map(Object.entries(attrs) as [string, AttributeSchema][]);
  }

  get relationshipsByName(): Map<string, RelationshipSchema> {
    let relationships = this.store._relationshipsDefinitionFor(this.modelName, this._id);
    return new Map(Object.entries(relationships) as [string, RelationshipSchema][]);
  }

  eachAttribute(callback: (key: string, attribute: AttributeSchema) => void, binding: unknown) {
    let attrDefs = this.store._attributesDefinitionFor(this.modelName, this._id);
    Object.keys(attrDefs).forEach(key => {
      callback.call(binding, key, attrDefs[key]);
    });
  }

  eachRelationship(callback: (key: string, relationship: RelationshipSchema) => void, binding: unknown) {
    let relationshipDefs = this.store._relationshipsDefinitionFor(this.modelName, this._id);
    Object.keys(relationshipDefs).forEach(key => {
      callback.call(binding, key, relationshipDefs[key]);
    });
  }

  eachTransformedAttribute(callback: (key: string, relationship: RelationshipSchema) => void, binding: unknown) {
    let relationshipDefs = this.store._relationshipsDefinitionFor(this.modelName, this._id);
    Object.keys(relationshipDefs).forEach(key => {
      if (relationshipDefs[key]!.type) {
        callback.call(binding, key, relationshipDefs[key]);
      }
    });
  }
}
