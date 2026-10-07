/* Configuração de perfil e faixa de valor. Edite aqui para ajustar as regras sem mexer no app.js. */
window.MM_PERFIL_CFG = {
  /* Faixas de valor da moto. Os valores em reais são ponto de partida: ajuste ao seu mercado. */
  faixas: [
    { id: 'economica', label: 'Econômica', faixa: 'até ~R$ 8 mil', cor: '#2ca66e' },
    { id: 'media', label: 'Média', faixa: '~R$ 8 a 20 mil', cor: '#4d82d8' },
    { id: 'alta', label: 'Alta', faixa: '~R$ 20 a 40 mil', cor: '#e8920f' },
    { id: 'premium', label: 'Premium', faixa: 'acima de ~R$ 40 mil', cor: '#8b5cf6' }
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
  /* Marcas por faixa (estimativa inicial; ajuste moto a moto no cadastro) */
  marcasPremium: ['Ducati', 'BMW', 'Harley-Davidson', 'Indian', 'MV Agusta', 'Moto Guzzi'],
  marcasAlta: ['KTM', 'Husqvarna', 'Husaberg', 'GasGas', 'GASGAS', 'Beta', 'TM Racing', 'Fantic', 'Montesa', 'Sherco', 'Ossa', 'Triumph', 'Aprilia'],
  marcasMedia: ['Royal Enfield', 'Benelli', 'CF Moto'],
  marcasEconomica: ['Dafra', 'Shineray', 'Bajaj'],
  marcasJaponesas: ['Honda', 'Yamaha', 'Kawasaki', 'Suzuki']
};
