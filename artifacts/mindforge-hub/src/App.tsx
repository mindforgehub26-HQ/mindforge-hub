import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { lazy, Suspense, Component, type ReactNode } from "react";
import Seo from "@/components/Seo";
import Analytics from "@/components/Analytics";
import Faq from "@/pages/Faq";
import Blog from "@/pages/Blog";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import TrackLookup from "@/pages/TrackLookup";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/Toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import Home from "@/pages/Home";
import Services from "@/pages/Services";
import Domains from "@/pages/Domains";
import Portfolio from "@/pages/Portfolio";
import HowItWorks from "@/pages/HowItWorks";
import Contact from "@/pages/Contact";
const Track = lazy(() => import("@/pages/Track"));
const Platform = lazy(() => import("@/platform/Entry"));
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

class PrivatePageBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="pt-28 px-6 text-center" role="alert"><h1 className="section-title">Account service unavailable</h1><p className="my-5">Please contact the business for help with your project.</p><a href="/contact" className="btn-primary">Contact support</a></div> : this.props.children; }
}

function AppContent() {
  const [location] = useLocation();
  const isAdminPath = /^\/(admin|dashboard|account)(\/|$)/.test(location) || location === '/sign-in';

  return (
    <div className="min-h-screen flex flex-col">
      <Seo />
      <Analytics />
      <a className="skip-link" href="#main-content">Skip to content</a>
      {(!isAdminPath || location.startsWith("/account")) && <Navbar />}
      <main id="main-content" tabIndex={-1} className="flex-1">
        <PrivatePageBoundary key={location}><Suspense fallback={<p role="status" className="pt-28 text-center">Loading account service…</p>}>
        {isAdminPath ? <Platform/> : <Switch>
          <Route path="/" component={Home} />
          <Route path="/services" component={Services} />
          <Route path="/domains" component={Domains} />
          <Route path="/portfolio" component={Portfolio} />
          <Route path="/how-it-works" component={HowItWorks} />
          <Route path="/contact" component={Contact} />
          <Route path="/faq" component={Faq} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/terms" component={Terms} />
          <Route path="/blog" component={Blog} />
          <Route path="/blog/choose-final-year-software-project" component={Blog} />
          <Route path="/blog/software-project-viva" component={Blog} />
          <Route path="/track" component={TrackLookup} />
          <Route path="/track/:id" component={Track} />
          <Route component={NotFound} />
        </Switch>}
        </Suspense></PrivatePageBoundary>
      </main>
      {(!isAdminPath || location.startsWith("/account")) && <Footer />}
      {!isAdminPath && <WhatsAppButton />}
    </div>
  );
}

function App({ ssrPath }: { ssrPath?: string }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <WouterRouter ssrPath={ssrPath} base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppContent />
        </WouterRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
