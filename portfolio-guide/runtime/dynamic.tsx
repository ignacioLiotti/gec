import { lazy, Suspense, type ComponentType } from "react";
export default function dynamic<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> } | ComponentType<P>>,
  options?: { loading?: ComponentType; ssr?: boolean },
) {
  const Component = lazy(async () => {
    const loaded = await loader();
    return { default: typeof loaded === "function" ? loaded : loaded.default };
  });
  const Loading = options?.loading;
  return function DeferredComponent(props: P) {
    return (
      <Suspense
        fallback={Loading ? <Loading /> : <p role="status">Loading view…</p>}
      >
        <Component {...props} />
      </Suspense>
    );
  };
}
