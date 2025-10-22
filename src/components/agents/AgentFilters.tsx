import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Search, Filter, X, SortAsc, SortDesc } from "lucide-react"

interface FilterOptions {
  search: string
  category: string
  status: string
  model: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
  tags: string[]
}

interface AgentFiltersProps {
  filters: FilterOptions
  onFiltersChange: (filters: FilterOptions) => void
  availableCategories: string[]
  availableModels: string[]
  availableTags: string[]
}

export function AgentFilters({ 
  filters, 
  onFiltersChange, 
  availableCategories, 
  availableModels, 
  availableTags 
}: AgentFiltersProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const updateFilter = (key: keyof FilterOptions, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const addTag = (tag: string) => {
    if (!filters.tags.includes(tag)) {
      updateFilter('tags', [...filters.tags, tag])
    }
  }

  const removeTag = (tag: string) => {
    updateFilter('tags', filters.tags.filter(t => t !== tag))
  }

  const clearAllFilters = () => {
    onFiltersChange({
      search: '',
      category: 'all',
      status: 'all',
      model: 'all',
      sortBy: 'name',
      sortOrder: 'asc',
      tags: []
    })
  }

  const hasActiveFilters = filters.search || 
                          filters.category !== 'all' || 
                          filters.status !== 'all' || 
                          filters.model !== 'all' || 
                          filters.tags.length > 0

  return (
    <div className="space-y-4">
      {/* Search and Quick Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar agentes..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex items-center gap-2">
          {/* Category Filter */}
          <Select value={filters.category} onValueChange={(value) => updateFilter('category', value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {availableCategories.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
            </SelectContent>
          </Select>

          {/* Advanced Filters */}
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filtros Avançados</h4>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                      Limpar
                    </Button>
                  )}
                </div>

                <Separator />

                {/* Model Filter */}
                <div>
                  <label className="text-sm font-medium">Modelo</label>
                  <Select value={filters.model} onValueChange={(value) => updateFilter('model', value)}>
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os modelos</SelectItem>
                      {availableModels.map(model => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort Options */}
                <div>
                  <label className="text-sm font-medium">Ordenar por</label>
                  <div className="flex gap-2 mt-1">
                    <Select value={filters.sortBy} onValueChange={(value) => updateFilter('sortBy', value)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Nome</SelectItem>
                        <SelectItem value="category">Categoria</SelectItem>
                        <SelectItem value="createdAt">Data de criação</SelectItem>
                        <SelectItem value="usageCount">Uso</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                    >
                      {filters.sortOrder === 'asc' ? 
                        <SortAsc className="h-4 w-4" /> : 
                        <SortDesc className="h-4 w-4" />
                      }
                    </Button>
                  </div>
                </div>

                {/* Tags Filter */}
                <div>
                  <label className="text-sm font-medium">Tags</label>
                  <div className="mt-1">
                    <Select onValueChange={addTag}>
                      <SelectTrigger>
                        <SelectValue placeholder="Adicionar tag" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTags
                          .filter(tag => !filters.tags.includes(tag))
                          .map(tag => (
                            <SelectItem key={tag} value={tag}>
                              {tag}
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Active Filters */}
      {(hasActiveFilters || filters.tags.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtros ativos:</span>
          
          {filters.category !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Categoria: {filters.category}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter('category', 'all')}
              />
            </Badge>
          )}

          {filters.status !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Status: {filters.status === 'active' ? 'Ativo' : 'Inativo'}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter('status', 'all')}
              />
            </Badge>
          )}

          {filters.model !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Modelo: {filters.model}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter('model', 'all')}
              />
            </Badge>
          )}

          {filters.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => removeTag(tag)}
              />
            </Badge>
          ))}

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              Limpar todos
            </Button>
          )}
        </div>
      )}
    </div>
  )
}