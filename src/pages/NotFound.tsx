import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center shadow-lg border-0">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="p-3 bg-warning/10 rounded-2xl">
              <AlertTriangle className="w-8 h-8 text-warning" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl">Página não encontrada</CardTitle>
            <CardDescription className="mt-2">
              A página que você está procurando não existe ou foi movida.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-6xl font-bold text-muted-foreground/30">404</div>
          <Button 
            onClick={() => window.location.href = "/"}
            className="bg-gradient-primary hover:bg-primary-hover shadow-primary"
          >
            Voltar ao Início
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;