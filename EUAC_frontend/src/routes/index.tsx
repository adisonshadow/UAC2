import { lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import AppLayout from '@/layouts/AppLayout';
import SecurityLayout from '@/layouts/SecurityLayout';
import AIChatHidden from '@/wrappers/AIChatHidden';
import BusinessDataDesignAI from '@/wrappers/BusinessDataDesignAI';
import BusinessDataMaterializeAI from '@/wrappers/BusinessDataMaterializeAI';
import { setNavigate } from '@/utils/navigation';

const Auth = lazy(() => import('@/pages/Auth'));
const ResetPSWD = lazy(() => import('@/pages/ResetPSWD'));
const Member = lazy(() => import('@/pages/MemberOrg/Member'));
const Organization = lazy(() => import('@/pages/MemberOrg/Organization'));
const Role = lazy(() => import('@/pages/MemberOrg/Role'));
const PermissionsMenu = lazy(() => import('@/pages/Permissions/Menu'));
const PermissionsButton = lazy(() => import('@/pages/Permissions/Button'));
const PermissionsAPI = lazy(() => import('@/pages/Permissions/API'));
const Applications = lazy(() => import('@/pages/ServiceProvider/Applications'));
const ModelDesigner = lazy(() => import('@/pages/BusinessData/ModelDesigner'));
const Materialization = lazy(() => import('@/pages/BusinessData/Materialization'));
const AIProviders = lazy(() => import('@/pages/AIManagement/Providers'));
const AIModels = lazy(() => import('@/pages/AIManagement/AiModels'));
const ChatDemo = lazy(() => import('@/pages/AIManagement/ChatDemo'));
const Scopes = lazy(() => import('@/pages/AIManagement/Scopes'));
const Tools = lazy(() => import('@/pages/AIManagement/Tools'));
const Skills = lazy(() => import('@/pages/AIManagement/Skills'));
const RequestLogs = lazy(() => import('@/pages/AIManagement/RequestLogs'));
const AccountCenter = lazy(() => import('@/pages/account/center'));
const Page404 = lazy(() => import('@/pages/404'));
const Page403 = lazy(() => import('@/pages/403'));
const Page401 = lazy(() => import('@/pages/401'));
const Page500 = lazy(() => import('@/pages/500'));

function NavigationBinder() {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigate(navigate);
  }, [navigate]);
  return null;
}

export default function AppRoutes() {
  return (
    <>
      <NavigationBinder />
      <Routes>
        <Route path="/" element={<Navigate to="/member_org" replace />} />

        <Route element={<AIChatHidden />}>
          <Route path="/auth/login" element={<Auth />} />
          <Route path="/auth/reset-password" element={<ResetPSWD />} />
        </Route>

        <Route element={<SecurityLayout />}>
          <Route element={<AppLayout />}>
            <Route path="/member_org" element={<Navigate to="/member_org/member" replace />} />
            <Route path="/member_org/member" element={<Member />} />
            <Route path="/member_org/organization" element={<Organization />} />
            <Route path="/member_org/role" element={<Role />} />

            <Route path="/permissions" element={<Navigate to="/permissions/menu" replace />} />
            <Route path="/permissions/menu" element={<PermissionsMenu />} />
            <Route path="/permissions/button" element={<PermissionsButton />} />
            <Route path="/permissions/api" element={<PermissionsAPI />} />

            <Route path="/service_provider" element={<Applications />} />

            <Route path="/business_data" element={<Navigate to="/business_data/model-design" replace />} />
            <Route element={<BusinessDataDesignAI />}>
              <Route path="/business_data/model-design" element={<ModelDesigner />} />
            </Route>
            <Route element={<BusinessDataMaterializeAI />}>
              <Route path="/business_data/materialization" element={<Materialization />} />
            </Route>

            <Route path="/ai_management" element={<Navigate to="/ai_management/providers" replace />} />
            <Route path="/ai_management/providers" element={<AIProviders />} />
            <Route path="/ai_management/models" element={<AIModels />} />
            <Route path="/ai_management/chat-demo" element={<ChatDemo />} />
            <Route path="/ai_management/scopes" element={<Scopes />} />
            <Route path="/ai_management/tools" element={<Tools />} />
            <Route path="/ai_management/skills" element={<Skills />} />
            <Route path="/ai_management/request-logs" element={<RequestLogs />} />
          </Route>

          <Route element={<AIChatHidden />}>
            <Route path="/account/center" element={<AccountCenter />} />
          </Route>
        </Route>

        <Route path="/403" element={<Page403 />} />
        <Route path="/401" element={<Page401 />} />
        <Route path="/500" element={<Page500 />} />
        <Route path="*" element={<Page404 />} />
      </Routes>
    </>
  );
}
