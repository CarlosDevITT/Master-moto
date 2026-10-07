/* Configuração de perfil, faixa de valor e títulos. Edite aqui para ajustar as regras sem mexer no app.js. */
window.MM_PERFIL_CFG = {
  /* Faixas de valor da moto. Os valores em reais são ponto de partida: ajuste ao seu mercado. */
  faixas: [
    { id: 'economica', label: 'Econômica', faixa: 'até ~R$ 8 mil', cor: '#2ca66e', adj: ['Custo-Benefício', 'Reforçada'] },
    { id: 'media', label: 'Média', faixa: '~R$ 8 a 20 mil', cor: '#4d82d8', adj: ['Qualidade', 'Reforçada'] },
    { id: 'alta', label: 'Alta', faixa: '~R$ 20 a 40 mil', cor: '#e8920f', adj: ['Original', 'Alta Performance'] },
    { id: 'premium', label: 'Premium', faixa: 'acima de ~R$ 40 mil', cor: '#8b5cf6', adj: ['Premium', 'Alta Performance'] }
  ],
  /* Nível da peça e quais faixas de moto combinam com ele. */
  pecas: [
    { id: 'basica', label: 'Básica', ate: 150, faixas: ['economica', 'media'] },
    { id: 'intermediaria', label: 'Intermediária', ate: 400, faixas: ['media', 'alta'] },
    { id: 'premium', label: 'Premium', ate: Infinity, faixas: ['alta', 'premium'] }
  ],
  /* Categoria da planilha -> perfil de uso */
  perfilPorCategoria: {
    'Street / Naked': 'Curva', 'Sport': 'Curva', 'SuperEsportiva': 'Curva',
    'Motocross': 'Competição', 'Enduro': 'Competição', 'Cross Country': 'Competição', 'Supermoto': 'Competição',
    'Off-Road / Trilha': 'Trilha',
    'Dual Sport': 'Aventura', 'Adventure / Trail': 'Aventura',
    'Touring / Classic': 'Estrada / Clássica', 'Scrambler': 'Estrada / Clássica'
  },
  perfis: ['Curva', 'Competição', 'Trilha', 'Aventura', 'Estrada / Clássica'],
  /* Segundo adjetivo do título conforme o perfil (só para motos de faixa Alta e Premium) */
  adjPerfil: { 'Curva': 'Alta Performance', 'Competição': 'Racing', 'Trilha': 'Reforçada', 'Aventura': 'Reforçada', 'Estrada / Clássica': 'Original' },
  /* Marcas por faixa (estimativa inicial; ajuste moto a moto no cadastro) */
  marcasPremium: ['Ducati', 'BMW', 'Harley-Davidson', 'Indian', 'MV Agusta', 'Moto Guzzi'],
  marcasAlta: ['KTM', 'Husqvarna', 'Husaberg', 'GasGas', 'GASGAS', 'Beta', 'TM Racing', 'Fantic', 'Montesa', 'Sherco', 'Ossa', 'Triumph', 'Aprilia'],
  marcasMedia: ['Royal Enfield', 'Benelli', 'CF Moto'],
  marcasEconomica: ['Dafra', 'Shineray', 'Bajaj'],
  marcasJaponesas: ['Honda', 'Yamaha', 'Kawasaki', 'Suzuki'],
  limiteTitulo: 60
};
