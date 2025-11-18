'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import ForgeViewer from './forgeviewer'
import {
  ArrowLeft,
  Share2,
  Download,
  Edit,
  Info,
  DollarSign,
  Calendar,
  TrendingUp,
  FileText,
  Users,
  Home,
  MapPin,
  Building2,
  Hash,
  Clock,
  Ruler,
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  Image as ImageIcon,
  FileCheck,
  Shield,
  HardHat,
  UserCheck,
} from 'lucide-react'

export default function ViewerPage() {
  const [activeTab, setActiveTab] = useState('general')

  // This would typically come from URL params or props
  const urn = 'dXJuOmFkc2sud2lwcHJvZDpmcy5maWxlOnZmLk1vZGVsXzIwMjQwMjE1XzE2MzAyMC5ydnQ_dmVyc2lvbj0x'

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb */}
      <div className="border-b bg-card">
        <div className="px-6 py-3">
          <div className="flex items-center text-sm text-muted-foreground">
            <Home className="w-4 h-4 mr-2" />
            <span>Proyectos</span>
            <span className="mx-2">/</span>
            <span>Vivienda Social</span>
            <span className="mx-2">/</span>
            <span className="text-foreground font-medium">15 Viviendas Tapebicua</span>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-semibold text-muted-foreground">#5</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  En Ejecución
                </Badge>
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  Prioridad Alta
                </Badge>
              </div>
              <h1 className="text-2xl font-bold mb-1">15 Viviendas Tapebicua</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span>TAPEBICUA, Corrientes</span>
                </div>
                <div className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  <span>Vivienda Social</span>
                </div>
                <div className="flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  <span>OC-2023-015</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="h-auto p-0 bg-transparent border-b rounded-none">
            <TabsTrigger value="general" className="flex items-center gap-2 px-1 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <Info className="w-4 h-4" />
              <span>General</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center gap-2 px-1 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <DollarSign className="w-4 h-4" />
              <span>Financiero</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2 px-1 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <Calendar className="w-4 h-4" />
              <span>Cronograma</span>
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex items-center gap-2 px-1 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <TrendingUp className="w-4 h-4" />
              <span>Avance</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2 px-1 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <FileText className="w-4 h-4" />
              <span>Documentos</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2 px-1 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <Users className="w-4 h-4" />
              <span>Equipo</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content Area */}
      <div className="px-6 py-6">
        {/* Alerts Section */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-yellow-50 border-yellow-200">
            <AlertTriangle className="text-yellow-600" />
            <span className="text-sm">Próximo vencimiento de póliza de seguro en 15 días</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-blue-50 border-blue-200">
            <Info className="text-blue-600" />
            <span className="text-sm">Certificación mensual pendiente de aprobación</span>
          </div>
        </div>

        {/* Key Metrics Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-card rounded-lg p-4 border hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Avance General</span>
              <TrendingUp className="text-blue-600 w-4 h-4" />
            </div>
            <p className="text-2xl font-bold">65%</p>
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: '65%' }}></div>
            </div>
          </div>

          <div className="bg-card rounded-lg p-4 border hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Avance Financiero</span>
              <DollarSign className="text-green-600 w-4 h-4" />
            </div>
            <p className="text-2xl font-bold">62%</p>
            <p className="text-xs text-muted-foreground mt-1">$298.025.000</p>
          </div>

          <div className="bg-card rounded-lg p-4 border hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Tiempo Transcurrido</span>
              <Clock className="text-purple-600 w-4 h-4" />
            </div>
            <p className="text-2xl font-bold">67%</p>
            <p className="text-xs text-muted-foreground mt-1">10/15 meses</p>
          </div>

          <div className="bg-card rounded-lg p-4 border hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Unidades</span>
              <Home className="text-orange-600 w-4 h-4" />
            </div>
            <p className="text-2xl font-bold">10/15</p>
            <p className="text-xs text-muted-foreground mt-1">Completadas</p>
          </div>

          <div className="bg-card rounded-lg p-4 border hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Superficie</span>
              <Ruler className="text-indigo-600 w-4 h-4" />
            </div>
            <p className="text-xl font-bold">2,850</p>
            <p className="text-xs text-muted-foreground mt-1">m² totales</p>
          </div>

          <div className="bg-card rounded-lg p-4 border hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Días Restantes</span>
              <CalendarCheck className="text-red-600 w-4 h-4" />
            </div>
            <p className="text-2xl font-bold">150</p>
            <p className="text-xs text-muted-foreground mt-1">Para finalización</p>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">

            {/* Progress Overview Card */}
            <div className="bg-card rounded-lg border">
              <div className="px-5 py-4 border-b">
                <h3 className="text-lg font-semibold">Avance por Componente</h3>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Estructuras</span>
                    <span className="text-sm font-semibold">95%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-600 rounded-full transition-all duration-500" style={{ width: '95%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Instalaciones</span>
                    <span className="text-sm font-semibold">70%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: '70%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Terminaciones</span>
                    <span className="text-sm font-semibold">45%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-purple-600 rounded-full transition-all duration-500" style={{ width: '45%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Infraestructura</span>
                    <span className="text-sm font-semibold">80%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-orange-600 rounded-full transition-all duration-500" style={{ width: '80%' }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-card rounded-lg border">
              <div className="px-5 py-4 border-b">
                <h3 className="text-lg font-semibold">Resumen Financiero</h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-muted rounded-lg p-4">
                    <span className="text-xs text-muted-foreground block mb-1">Monto de Contrato</span>
                    <p className="text-xl font-semibold">$458.500.000</p>
                    <p className="text-xs text-muted-foreground mt-1">Original: $425.000.000</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <span className="text-xs text-muted-foreground block mb-1">Certificado a la Fecha</span>
                    <p className="text-xl font-semibold text-green-600">$298.025.000</p>
                    <p className="text-xs text-muted-foreground mt-1">10 certificaciones</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Anticipo Financiero</span>
                    <span className="text-sm font-medium">$91.700.000</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Fondo de Reparo (5%)</span>
                    <span className="text-sm font-medium">$14.940.000</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Última Certificación</span>
                    <span className="text-sm font-medium">$28.500.000</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Saldo a Certificar</span>
                    <span className="text-sm font-medium text-orange-600">$160.475.000</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-muted-foreground">Índice de Ajuste</span>
                    <span className="text-sm font-medium">1.12x desde Marzo 2023</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Units Progress Grid */}
            <div className="bg-card rounded-lg border">
              <div className="px-5 py-4 border-b">
                <h3 className="text-lg font-semibold">Estado de Unidades de Vivienda</h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="p-3 rounded-lg border-2 border-green-500 bg-green-50 text-center hover:shadow-md transition-shadow">
                      <Home className="text-green-600 w-5 h-5 mx-auto mb-1" />
                      <p className="text-xs font-medium">Unidad {i + 1}</p>
                      <p className="text-xs mt-1 text-green-600">Completa</p>
                    </div>
                  ))}
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i + 10} className="p-3 rounded-lg border-2 border-blue-500 bg-blue-50 text-center hover:shadow-md transition-shadow">
                      <Home className="text-blue-600 w-5 h-5 mx-auto mb-1" />
                      <p className="text-xs font-medium">Unidad {i + 11}</p>
                      <p className="text-xs mt-1 text-blue-600">En Obra</p>
                    </div>
                  ))}
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i + 13} className="p-3 rounded-lg border-2 border-muted bg-muted/50 text-center hover:shadow-md transition-shadow">
                      <Home className="text-muted-foreground w-5 h-5 mx-auto mb-1" />
                      <p className="text-xs font-medium">Unidad {i + 14}</p>
                      <p className="text-xs mt-1 text-muted-foreground">Pendiente</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-muted-foreground">Completadas (10)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-sm text-muted-foreground">En Progreso (3)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-muted-foreground rounded-full"></div>
                      <span className="text-sm text-muted-foreground">Pendientes (2)</span>
                    </div>
                  </div>
                  <div className="text-sm font-medium">
                    67% Completado
                  </div>
                </div>
              </div>
            </div>

            {/* Project Photos */}
            <div className="bg-card rounded-lg border">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold">Registro Fotográfico</h3>
                <Button variant="link" className="text-sm">
                  Ver todas (458)
                </Button>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-muted rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                        <ImageIcon className="text-muted-foreground w-8 h-8" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Project Details */}
            <div className="bg-card rounded-lg border">
              <div className="px-4 py-3 border-b">
                <h3 className="text-sm font-semibold">Información del Proyecto</h3>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <span className="text-xs text-muted-foreground block">Contratista</span>
                  <p className="text-sm font-medium">Constructora Regional S.A.</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Entidad Contratante</span>
                  <p className="text-sm font-medium">Instituto Provincial de Vivienda (I.P.V.)</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">N° de Contrato</span>
                  <p className="text-sm font-medium">CONT-2023-0145</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">N° de Licitación</span>
                  <p className="text-sm font-medium">LIC-2022-089</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Superficie por Unidad</span>
                  <p className="text-sm font-medium">190 m²</p>
                </div>
              </div>
            </div>

            {/* Timeline/Milestones */}
            <div className="bg-card rounded-lg border">
              <div className="px-4 py-3 border-b">
                <h3 className="text-sm font-semibold">Hitos del Proyecto</h3>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  {[
                    { title: 'Inicio de Obra', date: '15 Mar 2023', completed: true },
                    { title: '50% Estructuras', date: '15 Sep 2023', completed: true },
                    { title: '100% Estructuras', date: '15 Ene 2024', completed: true },
                    { title: 'Instalaciones Completas', date: '15 Abr 2024', completed: false },
                    { title: 'Entrega Final', date: '15 Jun 2024', completed: false },
                  ].map((milestone, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${milestone.completed ? 'bg-green-500' : 'bg-muted'}`}></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{milestone.title}</p>
                        <p className="text-xs text-muted-foreground">{milestone.date}</p>
                      </div>
                      {milestone.completed && <CheckCircle2 className="text-green-500 w-4 h-4" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Team */}
            <div className="bg-card rounded-lg border">
              <div className="px-4 py-3 border-b">
                <h3 className="text-sm font-semibold">Equipo de Trabajo</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <HardHat className="text-blue-600 w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Ing. Carlos Rodriguez</p>
                    <p className="text-xs text-muted-foreground">Director de Proyecto</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <UserCheck className="text-green-600 w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Arq. Maria Gonzalez</p>
                    <p className="text-xs text-muted-foreground">Inspector de Obra</p>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className="text-lg font-semibold">45</p>
                    <p className="text-xs text-muted-foreground">Trabajadores</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">4</p>
                    <p className="text-xs text-muted-foreground">Subcontratistas</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-card rounded-lg border">
              <div className="px-4 py-3 border-b">
                <h3 className="text-sm font-semibold">Actividad Reciente</h3>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  {[
                    { icon: FileCheck, iconColor: 'text-green-600', title: 'Certificación N°10 presentada', date: '01 Feb 2024' },
                    { icon: TrendingUp, iconColor: 'text-blue-600', title: 'Vivienda #11 - Finalización de estructura', date: '28 Ene 2024' },
                    { icon: FileText, iconColor: 'text-purple-600', title: 'Actualización de cronograma aprobada', date: '25 Ene 2024' },
                    { icon: Shield, iconColor: 'text-orange-600', title: 'Inspección técnica sin observaciones', date: '20 Ene 2024' },
                  ].map((activity, i) => {
                    const Icon = activity.icon
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <Icon className={`${activity.iconColor} w-4 h-4 mt-0.5`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{activity.title}</p>
                          <p className="text-xs text-muted-foreground">{activity.date}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <Button variant="outline" className="w-full mt-4">
                  Ver toda la actividad
                </Button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-card rounded-lg border">
              <div className="px-4 py-3 border-b">
                <h3 className="text-sm font-semibold">Acciones Rápidas</h3>
              </div>
              <div className="p-4 space-y-2">
                <Button variant="ghost" className="w-full justify-start">
                  <FileCheck className="w-4 h-4 mr-2" />
                  Nueva Certificación
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Subir Fotos
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <FileText className="w-4 h-4 mr-2" />
                  Generar Informe
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <Calendar className="w-4 h-4 mr-2" />
                  Actualizar Cronograma
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
