import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import CalculationWorksheet from "./pages/CalculationWorksheet";
import InspectionList from "./pages/InspectionList";
import InspectionDetail from "./pages/InspectionDetail";
import NewInspection from "./pages/NewInspection";
import ImportData from "./pages/ImportData";
import ReportComparison from "./pages/ReportComparison";
import ImportPDF from "./pages/ImportPDF";
import ConvertImages from "./pages/ConvertImages";
import UploadUTResults from "./pages/UploadUTResults";
import ValidationDashboard from "./pages/ValidationDashboard";
import AnomalyTrends from "./pages/AnomalyTrends";
import FieldInspector from "./pages/FieldInspector";
import TrendAnalysis from "./pages/TrendAnalysis";
import API510Calculator from "./pages/API510Calculator";
import LocationMappingSettings from "./pages/LocationMappingSettings";
import RCRAComplianceDashboard from "./pages/RCRAComplianceDashboard";
import BatchReprocess from "./pages/BatchReprocess";
import DataMigration from "./pages/DataMigration";
import EngineeringAdvisor from "./pages/EngineeringAdvisor";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/calculation-worksheet"} component={CalculationWorksheet} />
      <Route path={"/inspections"} component={InspectionList} />
      <Route path={"/inspections/new"} component={NewInspection} />
      <Route path={"/inspections/:id"} component={InspectionDetail} />
      <Route path={"/import"} component={ImportData} />
      <Route path={"/comparison"} component={ReportComparison} />
      <Route path={"/import-pdf"} component={ImportPDF} />
      <Route path={"/convert-images"} component={ConvertImages} />
      <Route path={"/upload-ut-results"} component={UploadUTResults} />
      <Route path={"/validation/:inspectionId"} component={ValidationDashboard} />
      <Route path={"/anomalies/trends"} component={AnomalyTrends} />
      <Route path={"/field-inspector"} component={FieldInspector} />
      <Route path={"/trends/:vesselTagNumber"} component={TrendAnalysis} />
      <Route path={"/calculator"} component={API510Calculator} />
      <Route path={"/settings/location-mapping"} component={LocationMappingSettings} />
      <Route path={"/rcra-compliance/:inspectionId"} component={RCRAComplianceDashboard} />
      <Route path={"/batch-reprocess"} component={BatchReprocess} />
      <Route path={"/data-migration"} component={DataMigration} />
      <Route path={"/engineering-advisor"} component={EngineeringAdvisor} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

