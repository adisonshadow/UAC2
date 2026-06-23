import { useLocation } from '@umijs/max';
import { getMenuData } from '@ant-design/pro-components';
import { getMatchMenu } from '@umijs/route-utils';
import { ProLayout } from '@ant-design/pro-components';

export default (props: any) => {
  const location = useLocation();
  const { menuData } = getMenuData(props.route.routes);
  
  const matchedRoutes = getMatchMenu(location.pathname, menuData);
  const currentRoute = matchedRoutes[0] || {};
  
  return (
    <ProLayout
      {...props}
      location={location}
      menuData={menuData}
      menuRender={currentRoute.hideMenu ? false : undefined}
      pure={currentRoute.layout === false}
      contentStyle={currentRoute.hideMenu ? { margin: 0 } : undefined}
    >
      {props.children}
    </ProLayout>
  );
};