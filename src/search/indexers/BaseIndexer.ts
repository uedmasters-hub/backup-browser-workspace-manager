export interface BaseIndexer<
  TEntity,
> {
  index(
    entity: TEntity
  ): TEntity;

  indexMany(
    entities: TEntity[]
  ): TEntity[];
}