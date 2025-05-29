/**
 * Traffic Charts for QNow Platform
 * This file handles the rendering of traffic visualizations on the dashboard
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing traffic charts...');
  
  // Initialize charts when dashboard is shown
  const dashboardLink = document.querySelector('.nav-link[href="#dashboard"]');
  if (dashboardLink) {
    dashboardLink.addEventListener('click', () => {
      setTimeout(() => {
        initTrafficDonutChart();
        initTrafficPredictionChart();
      }, 300);
    });
  }
  
  // Initialize traffic donut chart
  function initTrafficDonutChart() {
    const ctx = document.getElementById('traffic-donut-chart');
    if (!ctx) return;
    
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
      console.error('Chart.js is not loaded. Please include Chart.js library.');
      return;
    }
    
    // Check if chart instance already exists
    if (ctx.chart) {
      ctx.chart.destroy();
    }
    
    // Chart data
    const data = {
      labels: ['Video Stream', 'Business Apps', 'Social Media', 'Others'],
      datasets: [{
        data: [38.4, 25.7, 16.9, 19.0],
        backgroundColor: [
          '#00a884', // Deep green
          '#00d0a5', // Medium green
          '#36cfbb', // Light teal
          '#60d7c2'  // Very light teal
        ],
        borderWidth: 0,
        cutout: '70%'
      }]
    };
    
    // Chart options
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.label}: ${context.raw}%`;
            }
          }
        }
      }
    };
    
    // Create chart instance
    ctx.chart = new Chart(ctx, {
      type: 'doughnut',
      data: data,
      options: options
    });
  }
  
  // Initialize traffic prediction chart
  function initTrafficPredictionChart() {
    const ctx = document.getElementById('traffic-prediction-chart');
    if (!ctx) return;
    
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
      console.error('Chart.js is not loaded. Please include Chart.js library.');
      return;
    }
    
    // Check if chart instance already exists
    if (ctx.chart) {
      ctx.chart.destroy();
    }
    
    // Generate some realistic-looking traffic prediction data
    const labels = [];
    const data = [];
    const now = new Date();
    
    for (let i = 0; i < 12; i++) {
      let time = new Date(now.getTime() + i * 5 * 60000);
      labels.push(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      
      // Generate a somewhat realistic traffic pattern with some variance
      const baseValue = 85000;
      const variance = Math.sin(i / 3) * 10000;
      const randomFactor = (Math.random() - 0.5) * 5000;
      data.push(baseValue + variance + randomFactor);
    }
    
    // Chart data
    const chartData = {
      labels: labels,
      datasets: [{
        label: 'Traffic (Kbps)',
        data: data,
        borderColor: '#00a884',
        backgroundColor: 'rgba(0, 168, 132, 0.1)',
        borderWidth: 2,
        tension: 0.3,
        fill: true
      }]
    };
    
    // Chart options
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `Traffic: ${Math.round(context.raw / 1000)} Mbps`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          min: 50000,
          max: 100000,
          ticks: {
            callback: function(value) {
              return `${value / 1000}k`;
            }
          }
        }
      }
    };
    
    // Create chart instance
    ctx.chart = new Chart(ctx, {
      type: 'line',
      data: chartData,
      options: options
    });
  }
  
  // Handle time selector tabs
  const timeOptions = document.querySelectorAll('.time-option');
  timeOptions.forEach(option => {
    option.addEventListener('click', () => {
      timeOptions.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
    });
  });
  
  // Initialize time selectors as interactive
  function initTimeSelectors() {
    const timeOptions = document.querySelectorAll('.time-option');
    if (timeOptions.length > 0) {
      timeOptions.forEach(option => {
        option.style.cursor = 'pointer';
      });
    }
  }
  
  // Initialize when dashboard is first loaded
  window.addEventListener('load', () => {
    if (window.location.hash === '#dashboard') {
      setTimeout(() => {
        initTrafficDonutChart();
        initTrafficPredictionChart();
        initTimeSelectors();
      }, 300);
    }
  });
}); 