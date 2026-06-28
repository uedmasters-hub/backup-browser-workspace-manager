export interface BaseMapper<
  TSource,
  TTarget,
> {
  map(
    source: TSource
  ): TTarget;

  mapMany(
    source: TSource[]
  ): TTarget[];
}