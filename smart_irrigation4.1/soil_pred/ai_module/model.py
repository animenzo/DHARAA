import torch
import torch.nn as nn


class ResidualNN(nn.Module):

    def __init__(self, input_size=6):
        super().__init__()

        self.net = nn.Sequential(
            nn.Linear(input_size, 16),
            nn.ReLU(),
            nn.Linear(16, 8),
            nn.ReLU(),
            nn.Linear(8, 1)
        )

    def forward(self, x):
        return self.net(x)