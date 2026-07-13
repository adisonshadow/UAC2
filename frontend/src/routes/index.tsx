import { lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import AppLayout from '@/layouts/AppLayout';
import SecurityLayout from '@/layouts/SecurityLayout';
import AIChatHidden from '@/wrappers/AIChatHidden';
import BusinessDataDesignAI from '@/wrappers/BusinessDataDesignAI';
import BusinessDataMaterializeAI from '@/wrappers/BusinessDataMaterializeAI';
import AIManagementAI from '@/wrappers/AIManagementAI';
import ApiServicesAI from '@/wrappers/ApiServicesAI';
import MemberOrgAI from '@/wrappers/MemberOrgAI';
import { setNavigate } from '@/utils/navigation';

const Auth = lazy(() => import('@/pages/Auth'));
const ResetPSWD = lazy(() => import('@/pages/ResetPSWD'));
const Member = lazy(() => import('@/pages/MemberOrg/Member'));
const MemberFormPage = lazy(() => import('@/pages/MemberOrg/Member/FormPage'));
const Organization = lazy(() => import('@/pages/MemberOrg/Organization'));
const OrganizationFormPage = lazy(() => import('@/pages/MemberOrg/Organization/FormPage'));
const Role = lazy(() => import('@/pages/MemberOrg/Role'));
const PermissionsMenu = lazy(() => import('@/pages/Permissions/Menu'));
const PermissionsButton = lazy(() => import('@/pages/Permissions/Button'));
const PermissionsAPI = lazy(() => import('@/pages/Permissions/BuiltinApi'));
const Applications = lazy(() => import('@/pages/ServiceProvider/Applications'));
const ApplicationFormPage = lazy(() => import('@/pages/ServiceProvider/Applications/FormPage'));
const ApplicationTopLevelSkillPage = lazy(() => import('@/pages/ServiceProvider/Applications/TopLevelSkillPage'));
const ApplicationPublicApiCatalog = lazy(() => import('@/pages/ServiceProvider/Applications/PublicApiCatalog'));
const FileStorageBuckets = lazy(() => import('@/pages/FileStorage/Buckets'));
const FileStorageBrowser = lazy(() => import('@/pages/FileStorage/Browser'));
const ModelDesigner = lazy(() => import('@/pages/BusinessData/ModelDesigner'));
const MaterializationExecute = lazy(() => import('@/pages/BusinessData/Materialization/Execute'));
const DatabaseConnections = lazy(() => import('@/pages/BusinessData/Materialization/Connections'));
const MaterializedDatabase = lazy(() => import('@/pages/BusinessData/Materialization/Database'));
const MaterializedTableSchema = lazy(() => import('@/pages/BusinessData/Materialization/TableBrowse/Schema'));
const MaterializedTableData = lazy(() => import('@/pages/BusinessData/Materialization/TableBrowse/Data'));
const MetricsList = lazy(() => import('@/pages/BusinessData/Metrics'));
const MetricsFormPage = lazy(() => import('@/pages/BusinessData/Metrics/FormPage'));
const MetricsDashboard = lazy(() => import('@/pages/BusinessData/Metrics/Dashboard'));
const CollectionPipelineList = lazy(() => import('@/pages/BusinessData/CollectionPipelines'));
const CollectionPipelineFormPage = lazy(() => import('@/pages/BusinessData/CollectionPipelines/FormPage'));
const CollectionPipelineTest = lazy(() => import('@/pages/BusinessData/CollectionPipelines/Test'));
const ApiServiceCreate = lazy(() => import('@/pages/ApiServices/Create'));
const ApiServiceList = lazy(() => import('@/pages/ApiServices/List'));
const ApiServiceEdit = lazy(() => import('@/pages/ApiServices/Edit'));
const ApiServiceTest = lazy(() => import('@/pages/ApiServices/Test'));
const OutboundWebhookList = lazy(() => import('@/pages/ApiServices/OutboundWebhooks'));
const OutboundWebhookFormPage = lazy(() => import('@/pages/ApiServices/OutboundWebhooks/FormPage'));
const OutboundWebhookTest = lazy(() => import('@/pages/ApiServices/OutboundWebhooks/Test'));
const AIProviders = lazy(() => import('@/pages/AIManagement/Providers'));
const ProviderFormPage = lazy(() => import('@/pages/AIManagement/Providers/FormPage'));
const AIModels = lazy(() => import('@/pages/AIManagement/AiModels'));
const ModelFormPage = lazy(() => import('@/pages/AIManagement/AiModels/FormPage'));
const ChatDemo = lazy(() => import('@/pages/AIManagement/ChatDemo'));
const Scopes = lazy(() => import('@/pages/AIManagement/Scopes'));
const ScopeFormPage = lazy(() => import('@/pages/AIManagement/Scopes/FormPage'));
const Tools = lazy(() => import('@/pages/AIManagement/Tools'));
const ToolFormPage = lazy(() => import('@/pages/AIManagement/Tools/FormPage'));
const Skills = lazy(() => import('@/pages/AIManagement/Skills'));
const SkillFormPage = lazy(() => import('@/pages/AIManagement/Skills/FormPage'));
const RequestLogs = lazy(() => import('@/pages/AIManagement/RequestLogs'));
const AccountCenter = lazy(() => import('@/pages/account/center'));
const SystemSettings = lazy(() => import('@/pages/System/Settings'));
const DataStandards = lazy(() => import('@/pages/BusinessData/DataStandards'));
const MetadataCatalog = lazy(() => import('@/pages/BusinessData/Metadata'));
const BusinessDataMetadataAI = lazy(() => import('@/wrappers/BusinessDataMetadataAI'));
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

        {/* 公开 API 文档：独立路由，避免 AnimatedOutlet 切换动画 */}
        <Route path="/public/applications/:code/api-docs" element={<ApplicationPublicApiCatalog />} />
        <Route path="/public/applications/:code/api-docs/*" element={<ApplicationPublicApiCatalog />} />

        <Route element={<AIChatHidden />}>
          <Route path="/auth/login" element={<Auth />} />
          <Route path="/auth/reset-password" element={<ResetPSWD />} />
        </Route>

        <Route element={<SecurityLayout />}>
          <Route element={<AppLayout />}>
            <Route path="/member_org" element={<Navigate to="/member_org/member" replace />} />
            <Route element={<MemberOrgAI />}>
              <Route path="/member_org/member" element={<Member />} />
              <Route path="/member_org/member/create" element={<MemberFormPage mode="create" />} />
              <Route path="/member_org/member/:id/edit" element={<MemberFormPage mode="edit" />} />
              <Route path="/member_org/organization" element={<Organization />} />
              <Route path="/member_org/organization/create" element={<OrganizationFormPage mode="create" />} />
              <Route path="/member_org/organization/:id/edit" element={<OrganizationFormPage mode="edit" />} />
              <Route path="/member_org/role" element={<Role />} />

              <Route path="/permissions" element={<Navigate to="/permissions/menu" replace />} />
              <Route path="/permissions/menu" element={<PermissionsMenu />} />
              <Route path="/permissions/button" element={<PermissionsButton />} />
              <Route path="/permissions/api" element={<PermissionsAPI />} />
            </Route>

            <Route path="/service_provider" element={<Applications />} />
            <Route path="/service_provider/create" element={<ApplicationFormPage mode="create" />} />
            <Route path="/service_provider/:id/edit" element={<ApplicationFormPage mode="edit" />} />
            <Route path="/service_provider/:id/top-level-skill" element={<ApplicationTopLevelSkillPage />} />

            <Route path="/file_storage" element={<Navigate to="/file_storage/buckets" replace />} />
            <Route path="/file_storage/buckets" element={<FileStorageBuckets />} />
            <Route path="/file_storage/browser" element={<FileStorageBrowser />} />

            <Route path="/business_data" element={<Navigate to="/business_data/model-design" replace />} />
            <Route element={<BusinessDataDesignAI />}>
              <Route path="/business_data/model-design" element={<ModelDesigner />} />
            </Route>
            <Route element={<BusinessDataMaterializeAI />}>
              <Route
                path="/business_data/materialization"
                element={<Navigate to="/business_data/materialization/execute" replace />}
              />
              <Route path="/business_data/materialization/execute" element={<MaterializationExecute />} />
              <Route path="/business_data/database-connections" element={<DatabaseConnections />} />
              <Route path="/business_data/database" element={<MaterializedDatabase />} />
              <Route
                path="/business_data/database/tables/:entityId/schema"
                element={<MaterializedTableSchema />}
              />
              <Route
                path="/business_data/database/tables/:entityId/data"
                element={<MaterializedTableData />}
              />
              <Route path="/business_data/metrics" element={<MetricsList />} />
              <Route path="/business_data/metrics/create" element={<MetricsFormPage mode="create" />} />
              <Route path="/business_data/metrics/:id/edit" element={<MetricsFormPage mode="edit" />} />
              <Route path="/business_data/metrics/dashboard" element={<MetricsDashboard />} />
            </Route>

            <Route element={<BusinessDataMetadataAI />}>
              <Route path="/business_data/data-standards" element={<DataStandards />} />
              <Route path="/business_data/metadata" element={<MetadataCatalog />} />
            </Route>

            <Route path="/system/settings" element={<SystemSettings />} />

            <Route element={<ApiServicesAI />}>
              <Route path="/api_services/collection-pipelines" element={<CollectionPipelineList />} />
              <Route
                path="/api_services/collection-pipelines/create"
                element={<CollectionPipelineFormPage mode="create" />}
              />
              <Route
                path="/api_services/collection-pipelines/:id/edit"
                element={<CollectionPipelineFormPage mode="edit" />}
              />
              <Route
                path="/api_services/collection-pipelines/:id/test"
                element={<CollectionPipelineTest />}
              />
              <Route path="/api_services" element={<Navigate to="/api_services/list" replace />} />
              <Route path="/api_services/create" element={<ApiServiceCreate />} />
              <Route path="/api_services/list" element={<ApiServiceList />} />
              <Route path="/api_services/:id/edit" element={<ApiServiceEdit />} />
              <Route path="/api_services/:id/test" element={<ApiServiceTest />} />
              <Route path="/api_services/outbound-webhooks" element={<OutboundWebhookList />} />
              <Route path="/api_services/outbound-webhooks/create" element={<OutboundWebhookFormPage mode="create" />} />
              <Route path="/api_services/outbound-webhooks/:id/edit" element={<OutboundWebhookFormPage mode="edit" />} />
              <Route path="/api_services/outbound-webhooks/:id/test" element={<OutboundWebhookTest />} />
            </Route>

            <Route path="/ai_management" element={<Navigate to="/ai_management/providers" replace />} />
            <Route element={<AIManagementAI />}>
              <Route path="/ai_management/providers" element={<AIProviders />} />
              <Route path="/ai_management/providers/create" element={<ProviderFormPage mode="create" />} />
              <Route path="/ai_management/providers/:id/edit" element={<ProviderFormPage mode="edit" />} />
              <Route path="/ai_management/providers/:id" element={<ProviderFormPage mode="view" />} />
              <Route path="/ai_management/models" element={<AIModels />} />
              <Route path="/ai_management/models/create" element={<ModelFormPage mode="create" />} />
              <Route path="/ai_management/models/:id/edit" element={<ModelFormPage mode="edit" />} />
              <Route path="/ai_management/models/:id" element={<ModelFormPage mode="view" />} />
              <Route path="/ai_management/chat-demo" element={<ChatDemo />} />
              <Route path="/ai_management/scopes" element={<Scopes />} />
              <Route path="/ai_management/scopes/create" element={<ScopeFormPage mode="create" />} />
              <Route path="/ai_management/scopes/:id/edit" element={<ScopeFormPage mode="edit" />} />
              <Route path="/ai_management/scopes/:id" element={<ScopeFormPage mode="view" />} />
              <Route path="/ai_management/tools" element={<Tools />} />
              <Route path="/ai_management/tools/create" element={<ToolFormPage mode="create" />} />
              <Route path="/ai_management/tools/:id/edit" element={<ToolFormPage mode="edit" />} />
              <Route path="/ai_management/tools/:id" element={<ToolFormPage mode="view" />} />
              <Route path="/ai_management/skills" element={<Skills />} />
              <Route path="/ai_management/skills/create" element={<SkillFormPage mode="create" />} />
              <Route path="/ai_management/skills/:id/edit" element={<SkillFormPage mode="edit" />} />
              <Route path="/ai_management/skills/:id" element={<SkillFormPage mode="view" />} />
              <Route path="/ai_management/request-logs" element={<RequestLogs />} />
            </Route>
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
