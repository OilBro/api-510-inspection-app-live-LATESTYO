import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface ThicknessTrendChartProps {
  component: string;
  location: string;
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    tension?: number;
    fill?: boolean;
    borderDash?: number[];
  }>;
}

export default function ThicknessTrendChart({
  component,
  location,
  labels,
  datasets,
}: ThicknessTrendChartProps) {
  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          usePointStyle: true,
          padding: 15,
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          label: function (context) {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y.toFixed(4) + " in";
            }
            return label;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: "Thickness (inches)",
        },
        ticks: {
          callback: function (value) {
            return Number(value).toFixed(3);
          },
        },
      },
      x: {
        title: {
          display: true,
          text: "Inspection Date",
        },
      },
    },
    interaction: {
      mode: "nearest",
      axis: "x",
      intersect: false,
    },
  };

  const chartData = {
    labels,
    datasets,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{component}</CardTitle>
        <CardDescription>Location: {location}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <Line options={options} data={chartData} />
        </div>
      </CardContent>
    </Card>
  );
}

