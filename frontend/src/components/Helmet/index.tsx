import { Children, isValidElement, useEffect, type ReactElement, type ReactNode } from 'react';

function extractTitle(children: ReactNode): string | undefined {
  let title: string | undefined;
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === 'title') {
      const props = (child as ReactElement<{ children?: ReactNode }>).props;
      title = String(props.children ?? '');
    }
  });
  return title;
}

export function Helmet({ children }: { children: ReactNode }) {
  useEffect(() => {
    const title = extractTitle(children);
    if (title) {
      document.title = title;
    }
  }, [children]);

  return null;
}
