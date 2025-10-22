// Script para limpar o cache do catálogo de modelos
// Execute este script no console do navegador para limpar o cache

console.log('Limpando cache do catálogo de modelos...');

// Limpar localStorage
localStorage.removeItem('model_catalog_override');
console.log('✓ model_catalog_override removido do localStorage');

// Limpar o cache global (se acessível)
if (typeof window !== 'undefined' && window.__modelCatalogCache) {
    window.__modelCatalogCache = null;
    console.log('✓ Cache global limpo');
}

// Recarregar a página para forçar atualização
console.log('Recarregando a página em 2 segundos...');
setTimeout(() => {
    window.location.reload();
}, 2000);
