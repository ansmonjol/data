/**
  @module @ember-data/store
*/
import { RecordIdentifier } from './identifier';
import { AttributesSchema, RelationshipsSchema } from './record-data-schemas';
// we import the class not the interface because we expect
// because we expect to use this internally with the more complete set
// of APIs

export interface SchemaDefinitionService {
  doesTypeExist(modelName: string): boolean;
  attributesDefinitionFor(identifier: RecordIdentifier | string): AttributesSchema;
  relationshipsDefinitionFor(identifier: RecordIdentifier | string): RelationshipsSchema;
}
