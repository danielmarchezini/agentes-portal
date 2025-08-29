import { useApp } from "@/contexts/AppContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield, Check, X } from "lucide-react";
import { permissionMatrix, getRoleLabel, getRoleIcon } from "@/lib/permissions";
import { UserRole } from "@/contexts/AppContext";

const PermissionsPage = () => {
  const { currentUser } = useApp();

  if (!currentUser) return null;

  const roles: UserRole[] = ['member', 'bot_manager', 'admin', 'owner'];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Papéis e Permissões</h1>
        <p className="text-muted-foreground">
          Visão geral das permissões por papel na organização
        </p>
      </div>

      {/* Current User Role */}
      <Card className="animate-scale-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Seu Papel Atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-lg py-2 px-4">
              <span className="mr-2">{getRoleIcon(currentUser.role)}</span>
              {getRoleLabel(currentUser.role)}
            </Badge>
            <div className="text-sm text-muted-foreground">
              {currentUser.name} • {currentUser.email}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permissions Matrix */}
      {permissionMatrix.map((category, categoryIndex) => (
        <Card key={category.category} className="animate-scale-in" style={{ animationDelay: `${categoryIndex * 0.1}s` }}>
          <CardHeader>
            <CardTitle>{category.category}</CardTitle>
            <CardDescription>
              Permissões relacionadas a {category.category.toLowerCase()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[300px]">Ação</TableHead>
                    {roles.map((role) => (
                      <TableHead key={role} className="text-center min-w-[120px]">
                        <div className="flex flex-col items-center gap-1">
                          <span>{getRoleIcon(role)}</span>
                          <span className="text-xs">{getRoleLabel(role)}</span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {category.permissions.map((permission, permissionIndex) => (
                    <TableRow 
                      key={permission.action}
                      className={`animate-fade-in`}
                      style={{ animationDelay: `${(categoryIndex * 0.1) + (permissionIndex * 0.05)}s` }}
                    >
                      <TableCell className="font-medium">
                        {permission.action}
                      </TableCell>
                      {roles.map((role) => (
                        <TableCell key={role} className="text-center">
                          <div className="flex justify-center">
                            {permission.roles[role] ? (
                              <div className="p-1 rounded-full bg-success/10">
                                <Check className="w-4 h-4 text-success" />
                              </div>
                            ) : (
                              <div className="p-1 rounded-full bg-destructive/10">
                                <X className="w-4 h-4 text-destructive" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Legend */}
      <Card className="animate-scale-in" style={{ animationDelay: '0.3s' }}>
        <CardHeader>
          <CardTitle>Legenda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <div className="p-1 rounded-full bg-success/10">
                <Check className="w-4 h-4 text-success" />
              </div>
              <span className="text-sm">Permissão concedida</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-1 rounded-full bg-destructive/10">
                <X className="w-4 h-4 text-destructive" />
              </div>
              <span className="text-sm">Permissão negada</span>
            </div>
          </div>
          
          <div className="mt-6 space-y-2">
            <h4 className="font-medium">Hierarquia de Papéis:</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>👑 <strong>Proprietário</strong>: Controle total sobre a organização</div>
              <div>🛡️ <strong>Administrador</strong>: Gerencia usuários e configurações</div>
              <div>🤖 <strong>Gestor de Bots</strong>: Cria e gerencia agentes de IA</div>
              <div>👤 <strong>Membro</strong>: Utiliza agentes e sugere melhorias</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PermissionsPage;