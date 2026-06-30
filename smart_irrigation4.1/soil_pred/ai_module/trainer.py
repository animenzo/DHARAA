import torch
import torch.optim as optim


class OnlineTrainer:

    def __init__(self, model):
        self.model = model
        self.optimizer = optim.Adam(
            model.parameters(),
            lr=0.0005,
            weight_decay=1e-5
        )
        self.loss_fn = torch.nn.MSELoss()

    def train_step(self, inputs, error):
        self.optimizer.zero_grad()

        prediction = self.model(inputs)

        loss = self.loss_fn(prediction, error)

        loss.backward()
        self.optimizer.step()

    def predict(self, inputs):
        with torch.no_grad():
            return self.model(inputs)