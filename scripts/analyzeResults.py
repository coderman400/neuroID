#!/usr/bin/env python3
"""
NeuroID Scalability Test Results Analyzer
Analyzes test results and generates comprehensive reports with visualizations.
"""

import json
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
from datetime import datetime
import argparse
import os

class ScalabilityAnalyzer:
    def __init__(self, results_file='scalability_results.json', csv_file='scalability_metrics.csv'):
        self.results_file = results_file
        self.csv_file = csv_file
        self.results = None
        self.df = None
        
    def load_data(self):
        """Load test results from JSON and CSV files"""
        print(" Loading test results...")
        
        # Load JSON results
        if os.path.exists(self.results_file):
            with open(self.results_file, 'r') as f:
                self.results = json.load(f)
            print(f" Loaded results from {self.results_file}")
        else:
            raise FileNotFoundError(f"Results file {self.results_file} not found")
        
        # Load CSV data
        if os.path.exists(self.csv_file):
            self.df = pd.read_csv(self.csv_file)
            print(f" Loaded transaction data from {self.csv_file}")
        else:
            print(f"  CSV file {self.csv_file} not found, using JSON transaction data")
            if 'transactions' in self.results:
                self.df = pd.DataFrame(self.results['transactions'])
    
    def generate_summary_report(self):
        """Generate a comprehensive summary report"""
        print("\n" + "="*60)
        print(" SCALABILITY TEST ANALYSIS REPORT")
        print("="*60)
        
        # Test Overview
        test_duration = self.results['totalDuration'] / 1000  # Convert to seconds
        identities_created = self.results['identitiesCreated']
        success_rate = (identities_created / 5000) * 100  # Assuming 5000 target
        
        print(f"\n🎯 Test Overview:")
        print(f"   Test Duration: {test_duration:.2f} seconds ({test_duration/60:.2f} minutes)")
        print(f"   Identities Created: {identities_created:,}")
        print(f"   Success Rate: {success_rate:.2f}%")
        print(f"   Total Transactions: {len(self.results.get('transactions', []))}")
        print(f"   Errors Encountered: {len(self.results.get('errors', []))}")
        
        # Performance Metrics
        metrics = self.results['performanceMetrics']
        print(f"\n Performance Metrics:")
        print(f"   Average TPS: {metrics['avgTPS']:.2f}")
        print(f"   Peak TPS: {metrics['maxTPS']:.2f}")
        print(f"   Minimum TPS: {metrics['minTPS']:.2f}")
        print(f"   Average Block Time: {metrics['avgBlockTime']:.2f} seconds")
        
        # Gas Analysis
        print(f"\n⛽ Gas Usage Analysis:")
        print(f"   Total Gas Used: {metrics['totalGasUsed']:,}")
        print(f"   Average Gas per Identity: {metrics['avgGasUsed']:,.0f}")
        print(f"   Estimated Cost (1 Gwei): {metrics['totalGasUsed'] * 1e-9:.6f} ETH")
        
        # Storage Analysis
        storage = self.results['storageMetrics']
        print(f"\n Storage Growth Analysis:")
        print(f"   Blocks Created: {storage['totalBlocks']}")
        print(f"   Estimated Storage Growth: {storage['estimatedStorageGrowth'] / (1024*1024):.2f} MB")
        print(f"   Storage per Identity: {storage['estimatedStorageGrowth'] / identities_created:.0f} bytes")
        
        # Throughput Analysis
        if len(self.results.get('blockTimes', [])) > 0:
            block_times = self.results['blockTimes']
            print(f"\n Block Time Analysis:")
            print(f"   Average Block Time: {np.mean(block_times):.2f}s")
            print(f"   Block Time Std Dev: {np.std(block_times):.2f}s")
            print(f"   Min Block Time: {np.min(block_times):.2f}s")
            print(f"   Max Block Time: {np.max(block_times):.2f}s")
        
        return {
            'test_duration': test_duration,
            'identities_created': identities_created,
            'success_rate': success_rate,
            'avg_tps': metrics['avgTPS'],
            'peak_tps': metrics['maxTPS'],
            'avg_block_time': metrics['avgBlockTime'],
            'total_gas': metrics['totalGasUsed'],
            'avg_gas_per_identity': metrics['avgGasUsed'],
            'storage_growth_mb': storage['estimatedStorageGrowth'] / (1024*1024)
        }
    
    def create_visualizations(self):
        """Create comprehensive visualizations"""
        print("\n Generating visualizations...")
        
        # Set style
        plt.style.use('seaborn-v0_8')
        sns.set_palette("husl")
        
        # Create figure with subplots
        fig = plt.figure(figsize=(20, 16))
        
        # 1. TPS Over Time
        if self.df is not None and 'timestamp' in self.df.columns:
            ax1 = plt.subplot(3, 3, 1)
            self.plot_tps_over_time(ax1)
        
        # 2. Gas Usage Distribution
        if self.df is not None and 'Gas Used' in self.df.columns:
            ax2 = plt.subplot(3, 3, 2)
            self.plot_gas_distribution(ax2)
        
        # 3. Transaction Duration Distribution
        if self.df is not None and 'Duration (ms)' in self.df.columns:
            ax3 = plt.subplot(3, 3, 3)
            self.plot_duration_distribution(ax3)
        
        # 4. Block Time Analysis
        if len(self.results.get('blockTimes', [])) > 0:
            ax4 = plt.subplot(3, 3, 4)
            self.plot_block_times(ax4)
        
        # 5. Cumulative Identities Created
        if self.df is not None:
            ax5 = plt.subplot(3, 3, 5)
            self.plot_cumulative_identities(ax5)
        
        # 6. Performance Summary
        ax6 = plt.subplot(3, 3, 6)
        self.plot_performance_summary(ax6)
        
        # 7. Batch Performance Comparison
        if self.df is not None and 'Batch Index' in self.df.columns:
            ax7 = plt.subplot(3, 3, 7)
            self.plot_batch_performance(ax7)
        
        # 8. Storage Growth Projection
        ax8 = plt.subplot(3, 3, 8)
        self.plot_storage_projection(ax8)
        
        # 9. Error Analysis
        if len(self.results.get('errors', [])) > 0:
            ax9 = plt.subplot(3, 3, 9)
            self.plot_error_analysis(ax9)
        
        plt.tight_layout()
        plt.savefig('scalability_analysis.png', dpi=300, bbox_inches='tight')
        print(" Visualizations saved to scalability_analysis.png")
        
    def plot_tps_over_time(self, ax):
        """Plot TPS over time"""
        if 'Timestamp' not in self.df.columns:
            return
            
        # Calculate TPS in 10-second windows
        df_sorted = self.df.sort_values('Timestamp')
        window_size = 10000  # 10 seconds in milliseconds
        
        windows = []
        start_time = df_sorted['Timestamp'].min()
        end_time = df_sorted['Timestamp'].max()
        
        for window_start in range(int(start_time), int(end_time), window_size):
            window_end = window_start + window_size
            window_txs = df_sorted[
                (df_sorted['Timestamp'] >= window_start) & 
                (df_sorted['Timestamp'] < window_end)
            ]
            
            if len(window_txs) > 0:
                tps = len(window_txs) / (window_size / 1000)
                windows.append({
                    'time': (window_start - start_time) / 1000,
                    'tps': tps
                })
        
        if windows:
            window_df = pd.DataFrame(windows)
            ax.plot(window_df['time'], window_df['tps'], linewidth=2)
            ax.set_title('Throughput Over Time')
            ax.set_xlabel('Time (seconds)')
            ax.set_ylabel('Transactions Per Second (TPS)')
            ax.grid(True, alpha=0.3)
    
    def plot_gas_distribution(self, ax):
        """Plot gas usage distribution"""
        gas_data = self.df['Gas Used']
        ax.hist(gas_data, bins=50, alpha=0.7, edgecolor='black')
        ax.axvline(gas_data.mean(), color='red', linestyle='--', 
                   label=f'Mean: {gas_data.mean():.0f}')
        ax.set_title('Gas Usage Distribution')
        ax.set_xlabel('Gas Used')
        ax.set_ylabel('Frequency')
        ax.legend()
        ax.grid(True, alpha=0.3)
    
    def plot_duration_distribution(self, ax):
        """Plot transaction duration distribution"""
        duration_data = self.df['Duration (ms)']
        ax.hist(duration_data, bins=50, alpha=0.7, edgecolor='black')
        ax.axvline(duration_data.mean(), color='red', linestyle='--', 
                   label=f'Mean: {duration_data.mean():.0f}ms')
        ax.set_title('Transaction Duration Distribution')
        ax.set_xlabel('Duration (ms)')
        ax.set_ylabel('Frequency')
        ax.legend()
        ax.grid(True, alpha=0.3)
    
    def plot_block_times(self, ax):
        """Plot block time analysis"""
        block_times = self.results['blockTimes']
        ax.plot(range(len(block_times)), block_times, linewidth=2)
        ax.axhline(np.mean(block_times), color='red', linestyle='--', 
                   label=f'Average: {np.mean(block_times):.2f}s')
        ax.set_title('Block Times')
        ax.set_xlabel('Block Number')
        ax.set_ylabel('Block Time (seconds)')
        ax.legend()
        ax.grid(True, alpha=0.3)
    
    def plot_cumulative_identities(self, ax):
        """Plot cumulative identities created over time"""
        df_sorted = self.df.sort_values('Timestamp')
        start_time = df_sorted['Timestamp'].min()
        df_sorted['relative_time'] = (df_sorted['Timestamp'] - start_time) / 1000
        df_sorted['cumulative'] = range(1, len(df_sorted) + 1)
        
        ax.plot(df_sorted['relative_time'], df_sorted['cumulative'], linewidth=2)
        ax.set_title('Cumulative Identities Created')
        ax.set_xlabel('Time (seconds)')
        ax.set_ylabel('Total Identities')
        ax.grid(True, alpha=0.3)
    
    def plot_performance_summary(self, ax):
        """Plot performance metrics summary"""
        metrics = self.results['performanceMetrics']
        labels = ['Avg TPS', 'Max TPS', 'Min TPS']
        values = [metrics['avgTPS'], metrics['maxTPS'], metrics['minTPS']]
        
        bars = ax.bar(labels, values, alpha=0.7)
        ax.set_title('TPS Performance Summary')
        ax.set_ylabel('Transactions Per Second')
        
        # Add value labels on bars
        for bar, value in zip(bars, values):
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.1,
                   f'{value:.2f}', ha='center', va='bottom')
    
    def plot_batch_performance(self, ax):
        """Plot batch performance comparison"""
        batch_performance = self.df.groupby('Batch Index').agg({
            'Duration (ms)': 'mean',
            'Gas Used': 'mean'
        }).reset_index()
        
        ax2 = ax.twinx()
        
        line1 = ax.plot(batch_performance['Batch Index'], 
                       batch_performance['Duration (ms)'], 
                       'b-', label='Avg Duration (ms)')
        line2 = ax2.plot(batch_performance['Batch Index'], 
                        batch_performance['Gas Used'], 
                        'r-', label='Avg Gas Used')
        
        ax.set_xlabel('Batch Index')
        ax.set_ylabel('Average Duration (ms)', color='b')
        ax2.set_ylabel('Average Gas Used', color='r')
        ax.set_title('Batch Performance Comparison')
        
        # Combine legends
        lines = line1 + line2
        labels = [l.get_label() for l in lines]
        ax.legend(lines, labels, loc='upper left')
    
    def plot_storage_projection(self, ax):
        """Plot storage growth projection"""
        current_identities = self.results['identitiesCreated']
        current_storage = self.results['storageMetrics']['estimatedStorageGrowth'] / (1024*1024)  # MB
        
        # Project storage growth for different scales
        scales = [1000, 5000, 10000, 50000, 100000, 500000, 1000000]
        storage_projections = [(scale / current_identities) * current_storage for scale in scales]
        
        ax.plot(scales, storage_projections, 'o-', linewidth=2, markersize=8)
        ax.set_title('Storage Growth Projection')
        ax.set_xlabel('Number of Identities')
        ax.set_ylabel('Estimated Storage (MB)')
        ax.set_xscale('log')
        ax.set_yscale('log')
        ax.grid(True, alpha=0.3)
        
        # Add current test point
        ax.plot(current_identities, current_storage, 'ro', markersize=10, 
               label=f'Current Test\n({current_identities:,} identities)')
        ax.legend()
    
    def plot_error_analysis(self, ax):
        """Plot error analysis if errors exist"""
        errors = self.results.get('errors', [])
        if not errors:
            ax.text(0.5, 0.5, 'No Errors Detected', 
                   transform=ax.transAxes, ha='center', va='center', fontsize=16)
            ax.set_title('Error Analysis')
            return
        
        # Analyze error types
        error_types = {}
        for error in errors:
            error_msg = error.get('error', 'Unknown')
            # Simplify error messages for categorization
            if 'gas' in error_msg.lower():
                error_type = 'Gas Related'
            elif 'timeout' in error_msg.lower():
                error_type = 'Timeout'
            elif 'network' in error_msg.lower():
                error_type = 'Network'
            else:
                error_type = 'Other'
            
            error_types[error_type] = error_types.get(error_type, 0) + 1
        
        if error_types:
            ax.pie(error_types.values(), labels=error_types.keys(), autopct='%1.1f%%')
            ax.set_title(f'Error Distribution ({len(errors)} total)')
    
    def generate_comparison_table(self):
        """Generate comparison table with theoretical vs actual results"""
        print("\n Theoretical vs Actual Performance Comparison")
        print("="*60)
        
        # Theoretical values from the paper (Table II)
        theoretical_gas = {
            'registerIdentity': 66668,
            'verifyIdentity': 28868,
            'grantAccess': 71393,
            'checkAccess': 38825
        }
        
        actual_avg_gas = self.results['performanceMetrics']['avgGasUsed']
        
        print(f"Gas Usage Comparison:")
        print(f"  Theoretical (registerIdentity): {theoretical_gas['registerIdentity']:,} gas")
        print(f"  Actual (average): {actual_avg_gas:,.0f} gas")
        print(f"  Difference: {((actual_avg_gas - theoretical_gas['registerIdentity']) / theoretical_gas['registerIdentity'] * 100):+.1f}%")
        
        # Performance comparison
        actual_tps = self.results['performanceMetrics']['avgTPS']
        actual_block_time = self.results['performanceMetrics']['avgBlockTime']
        
        print(f"\nPerformance Metrics:")
        print(f"  Actual Average TPS: {actual_tps:.2f}")
        print(f"  Actual Block Time: {actual_block_time:.2f}s")
        print(f"  Network Configuration: 2s block time, PoA consensus")
        
    def save_detailed_report(self):
        """Save detailed analysis report to file"""
        report_filename = f"scalability_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        
        with open(report_filename, 'w') as f:
            f.write("# NeuroID Scalability Test Report\n\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            # Test Configuration
            f.write("## Test Configuration\n\n")
            f.write("- **Network**: Private Ethereum (Ganache)\n")
            f.write("- **Consensus**: Proof of Authority (PoA)\n")
            f.write("- **Block Time**: 2 seconds\n")
            f.write("- **Gas Limit**: 30,000,000 per block\n")
            f.write(f"- **Target Identities**: 5,000\n")
            f.write(f"- **Actual Identities**: {self.results['identitiesCreated']:,}\n\n")
            
            # Results Summary
            metrics = self.results['performanceMetrics']
            f.write("## Results Summary\n\n")
            f.write(f"- **Average TPS**: {metrics['avgTPS']:.2f}\n")
            f.write(f"- **Peak TPS**: {metrics['maxTPS']:.2f}\n")
            f.write(f"- **Average Block Time**: {metrics['avgBlockTime']:.2f} seconds\n")
            f.write(f"- **Total Gas Used**: {metrics['totalGasUsed']:,}\n")
            f.write(f"- **Average Gas per Identity**: {metrics['avgGasUsed']:,.0f}\n")
            
            storage = self.results['storageMetrics']
            f.write(f"- **Storage Growth**: {storage['estimatedStorageGrowth'] / (1024*1024):.2f} MB\n")
            f.write(f"- **Blocks Created**: {storage['totalBlocks']}\n\n")
            
            # Scalability Analysis
            f.write("## Scalability Analysis\n\n")
            f.write("### Storage Scaling\n")
            current_identities = self.results['identitiesCreated']
            current_storage = storage['estimatedStorageGrowth'] / (1024*1024)
            storage_per_identity = current_storage / current_identities
            
            f.write(f"- **Storage per Identity**: {storage_per_identity:.4f} MB\n")
            f.write(f"- **Projected Storage for 100K identities**: {storage_per_identity * 100000:.1f} MB\n")
            f.write(f"- **Projected Storage for 1M identities**: {storage_per_identity * 1000000:.1f} GB\n\n")
            
            f.write("### Performance Scaling\n")
            f.write(f"- **Current throughput** supports ~{metrics['avgTPS'] * 86400:.0f} identities/day\n")
            f.write(f"- **Time to process 1M identities**: ~{1000000 / (metrics['avgTPS'] * 86400):.1f} days\n\n")
            
            # Recommendations
            f.write("## Recommendations\n\n")
            f.write("1. **Network Optimization**: Consider optimizing block time and gas limits for higher throughput\n")
            f.write("2. **Batch Processing**: Implement batch registration for improved efficiency\n")
            f.write("3. **Storage Management**: Implement data retention policies for long-term scalability\n")
            f.write("4. **Monitoring**: Deploy comprehensive monitoring for production environments\n\n")
            
            if self.results.get('errors'):
                f.write(f"## Errors Encountered\n\n")
                f.write(f"Total errors: {len(self.results['errors'])}\n\n")
                for i, error in enumerate(self.results['errors'][:10]):  # Show first 10 errors
                    f.write(f"{i+1}. {error.get('error', 'Unknown error')}\n")
                if len(self.results['errors']) > 10:
                    f.write(f"... and {len(self.results['errors']) - 10} more\n")
        
        print(f" Detailed report saved to {report_filename}")

def main():
    parser = argparse.ArgumentParser(description='Analyze NeuroID scalability test results')
    parser.add_argument('--results', default='scalability_results.json', 
                       help='Path to results JSON file')
    parser.add_argument('--csv', default='scalability_metrics.csv', 
                       help='Path to metrics CSV file')
    parser.add_argument('--no-plots', action='store_true', 
                       help='Skip generating plots')
    
    args = parser.parse_args()
    
    analyzer = ScalabilityAnalyzer(args.results, args.csv)
    
    try:
        analyzer.load_data()
        summary = analyzer.generate_summary_report()
        analyzer.generate_comparison_table()
        
        if not args.no_plots:
            analyzer.create_visualizations()
        
        analyzer.save_detailed_report()
        
        print(f"\n Analysis complete! Check the generated files:")
        print(f"   - scalability_analysis.png (visualizations)")
        print(f"   - scalability_report_*.md (detailed report)")
        
    except Exception as e:
        print(f" Analysis failed: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main()) 