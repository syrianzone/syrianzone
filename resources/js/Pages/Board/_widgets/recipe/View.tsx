import { useState } from 'react';
import { ChefHat, Clock, MapPin } from 'lucide-react';
import { WidgetShell } from '../../_components/WidgetShell';
import { useWidgetQuery } from '../../_lib/query';
import { sources } from '../../_lib/sources';
import type { WidgetProps } from '../../_lib/types';
import { recipeWidget } from './index';

export default function RecipeView({}: WidgetProps) {
  const query = useWidgetQuery(recipeWidget, 'today', () => sources.recipeOfTheDay());
  const recipe = query.data;

  // a dead image on the sibling app must cost us the thumbnail, not the tile
  const [imageBroken, setImageBroken] = useState(false);
  const showImage = Boolean(recipe?.image_url) && !imageBroken;

  const firstTime = recipe?.time_needed?.[0];

  return (
    <WidgetShell
      title="وصفة اليوم"
      icon={ChefHat}
      loading={query.isPending}
      refreshing={query.isFetching && !query.isPending}
      error={query.isError ? 'تعذر تحميل وصفة اليوم' : null}
      onRetry={() => query.refetch()}
      empty={!query.isPending && !query.isError && !recipe}
      emptyText="لا توجد وصفة اليوم"
    >
      {recipe && (
        <a
          href={recipe.url}
          target="_blank"
          rel="noreferrer"
          dir="rtl"
          className="flex h-full flex-col gap-2 p-3 hover:bg-accent/50"
        >
          {showImage && (
            <img
              src={recipe.image_url ?? undefined}
              alt={recipe.name}
              loading="lazy"
              onError={() => setImageBroken(true)}
              className="h-24 w-full shrink-0 rounded-lg object-cover"
            />
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{recipe.name}</p>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {recipe.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {recipe.city}
                </span>
              )}
              {firstTime && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {firstTime.value}
                </span>
              )}
              {recipe.difficulty && <span>{recipe.difficulty}</span>}
            </div>

            {recipe.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {recipe.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <span dir="ltr" className="shrink-0 text-xs text-muted-foreground">
            food.syrian.zone
          </span>
        </a>
      )}
    </WidgetShell>
  );
}
